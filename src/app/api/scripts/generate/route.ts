import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { CREDIT_COSTS, type SavedAd } from "@/lib/types";

const bodySchema = z.object({
  savedAdId: z.string().uuid(),
  angle: z.string().max(200).default("Direct response"),
});

const variationsSchema = z.object({
  variations: z
    .array(
      z.object({
        title: z.string(),
        script: z.string(),
      })
    )
    .length(3),
});

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
  const { savedAdId, angle } = parsed.data;

  // RLS guarantees the ad belongs to this user.
  const { data: ad } = await supabase
    .from("saved_ads")
    .select("*")
    .eq("id", savedAdId)
    .single<SavedAd>();
  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  const source = [
    ad.transcript ? `TRANSCRIPT:\n${ad.transcript}` : null,
    ad.ad_copy ? `AD COPY:\n${ad.ad_copy}` : null,
    ad.cta_text ? `CTA: ${ad.cta_text}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!source) {
    return NextResponse.json(
      { error: "This ad has no transcript or copy to work from yet." },
      { status: 400 }
    );
  }

  const ok = await spendCredits(
    user.id,
    CREDIT_COSTS.generate_script,
    "generate_script"
  );
  if (!ok) {
    return NextResponse.json(
      { error: "You're out of credits. Upgrade your plan in Settings." },
      { status: 402 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a senior direct-response copywriter specializing in Meta (Facebook/Instagram) video ads.
Given a winning competitor ad, write 3 NEW script variations that keep the persuasive structure but are original — never copy sentences verbatim.

Rules:
- Each script is 30-60 seconds when read aloud (roughly 80-150 words).
- Hook in the first 2 lines (scroll-stopping).
- Write for voiceover: conversational, punchy, no camera directions.
- End with a clear call to action.
- Requested creative angle: "${angle}".

Respond with JSON: {"variations": [{"title": "...", "script": "..."}, ...]} — exactly 3 items.`,
      },
      { role: "user", content: source },
    ],
    temperature: 0.9,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let variations: { title: string; script: string }[];
  try {
    variations = variationsSchema.parse(JSON.parse(raw)).variations;
  } catch {
    return NextResponse.json(
      { error: "The AI returned an unexpected format. Try again." },
      { status: 502 }
    );
  }

  const rows = variations.map((v, i) => ({
    user_id: user.id,
    saved_ad_id: savedAdId,
    title: v.title,
    content: v.script,
    variation_number: i + 1,
    model: "gpt-4o",
    prompt_params: { angle },
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("generated_scripts")
    .insert(rows)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ scripts: inserted });
}
