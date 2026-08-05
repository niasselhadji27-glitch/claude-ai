import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  id: z.string(),
  status: z.string(),
  url: z.string().url().optional(),
  metadata: z.string().optional(),
});

/**
 * Creatomate render status webhook. Matches the render row by
 * provider_render_id (with metadata.render_id as a fallback).
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { id, status, url, metadata } = parsed.data;

  const admin = createAdminClient();

  let renderId: string | null = null;
  try {
    renderId = metadata ? (JSON.parse(metadata).render_id ?? null) : null;
  } catch {
    renderId = null;
  }

  const query = admin.from("rendered_videos").select("id, status");
  const { data: render } = renderId
    ? await query.eq("id", renderId).single()
    : await query.eq("provider_render_id", id).single();

  if (!render) {
    return NextResponse.json({ error: "Unknown render" }, { status: 404 });
  }

  if (status === "succeeded" && url) {
    await admin
      .from("rendered_videos")
      .update({ status: "completed", output_url: url })
      .eq("id", render.id);
  } else if (status === "failed") {
    await admin
      .from("rendered_videos")
      .update({ status: "failed", error_message: "Provider render failed" })
      .eq("id", render.id);
  }
  // planned / transcribing / rendering — keep current "rendering" status.

  return NextResponse.json({ ok: true });
}
