import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spendCredits } from "@/lib/credits";
import {
  CREDIT_COSTS,
  type GeneratedScript,
  type VoiceProfile,
} from "@/lib/types";

const bodySchema = z.object({
  scriptId: z.string().uuid(),
  voiceProfileId: z.string().uuid().nullable(),
  backgroundPath: z.string().max(500).nullable(),
});

const DEFAULT_ELEVENLABS_VOICE = "21m00Tcm4TlvDq8ikWAM"; // "Rachel"

/**
 * Starts a render: generates the ElevenLabs voiceover, uploads it to
 * Storage, then triggers a Creatomate render. Creatomate reports progress
 * to /api/webhooks/creatomate.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { scriptId, voiceProfileId, backgroundPath } = parsed.data;

  // RLS scopes both lookups to the current user (or platform voices).
  const { data: script } = await supabase
    .from("generated_scripts")
    .select("*")
    .eq("id", scriptId)
    .single<GeneratedScript>();
  if (!script) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }

  let voice: VoiceProfile | null = null;
  if (voiceProfileId) {
    const { data } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", voiceProfileId)
      .single<VoiceProfile>();
    voice = data;
  }
  const elevenLabsVoiceId =
    voice?.elevenlabs_voice_id ?? DEFAULT_ELEVENLABS_VOICE;

  // Reject a background path outside the user's own folder.
  if (backgroundPath && !backgroundPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: render, error: renderError } = await admin
    .from("rendered_videos")
    .insert({
      user_id: user.id,
      generated_script_id: scriptId,
      voice_profile_id: voiceProfileId,
      status: "queued",
      provider: "creatomate",
      template_id: process.env.CREATOMATE_TEMPLATE_ID ?? null,
      background_asset_paths: backgroundPath ? [backgroundPath] : [],
    })
    .select()
    .single();
  if (renderError || !render) {
    return NextResponse.json({ error: "Could not create render" }, { status: 500 });
  }

  const ok = await spendCredits(user.id, CREDIT_COSTS.render, "render");
  if (!ok) {
    await admin
      .from("rendered_videos")
      .update({ status: "failed", error_message: "Insufficient credits" })
      .eq("id", render.id);
    return NextResponse.json(
      { error: "You're out of credits. Upgrade your plan in Settings." },
      { status: 402 }
    );
  }

  try {
    // 1. Voiceover via ElevenLabs
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script.content,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!ttsRes.ok) {
      throw new Error(`ElevenLabs error ${ttsRes.status}`);
    }
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    const voPath = `${user.id}/vo-${render.id}.mp3`;
    const { error: uploadError } = await admin.storage
      .from("renders")
      .upload(voPath, audioBuffer, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    // 2. Signed URLs so Creatomate can fetch the private assets
    const { data: voSigned } = await admin.storage
      .from("renders")
      .createSignedUrl(voPath, 60 * 60 * 24);
    if (!voSigned?.signedUrl) throw new Error("Could not sign voiceover URL");

    let backgroundUrl: string | null = null;
    if (backgroundPath) {
      const { data: bgSigned } = await admin.storage
        .from("user-assets")
        .createSignedUrl(backgroundPath, 60 * 60 * 24);
      backgroundUrl = bgSigned?.signedUrl ?? null;
    }

    // 3. Trigger the Creatomate render
    const modifications: Record<string, string> = {
      "voiceover.source": voSigned.signedUrl,
      "script-text.text": script.content,
    };
    if (backgroundUrl) modifications["background.source"] = backgroundUrl;

    const cmRes = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CREATOMATE_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: process.env.CREATOMATE_TEMPLATE_ID,
        modifications,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/creatomate`,
        metadata: JSON.stringify({ render_id: render.id }),
      }),
    });
    if (!cmRes.ok) {
      throw new Error(`Creatomate error ${cmRes.status}`);
    }
    const cmBody = (await cmRes.json()) as { id: string }[];
    const providerRenderId = Array.isArray(cmBody) ? cmBody[0]?.id : undefined;

    await admin
      .from("rendered_videos")
      .update({
        status: "rendering",
        provider_render_id: providerRenderId ?? null,
        voiceover_storage_path: voPath,
      })
      .eq("id", render.id);

    return NextResponse.json({ renderId: render.id });
  } catch (err) {
    await admin
      .from("rendered_videos")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Render failed",
      })
      .eq("id", render.id);
    return NextResponse.json(
      { error: "Render failed to start. Check your provider configuration." },
      { status: 502 }
    );
  }
}
