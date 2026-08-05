import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const adSchema = z.object({
  meta_ad_id: z.string().nullable().optional(),
  meta_page_name: z.string().nullable().optional(),
  meta_ad_library_url: z.string().nullable().optional(),
  media_type: z.enum(["video", "image", "carousel"]).default("video"),
  media_url: z.string().url().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  ad_copy: z.string().nullable().optional(),
  cta_text: z.string().nullable().optional(),
  landing_page_url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const bodySchema = z.object({
  job_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(["completed", "failed"]),
  error: z.string().nullable().optional(),
  ads: z.array(adSchema).default([]),
});

/**
 * Called by the Python scraper service when a scrape job finishes.
 * Re-hosts scraped creatives into Supabase Storage (Meta CDN URLs expire)
 * and inserts saved_ads rows.
 */
export async function POST(request: Request) {
  if (
    request.headers.get("x-api-key") !== process.env.SCRAPER_API_KEY ||
    !process.env.SCRAPER_API_KEY
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { job_id, user_id, status, error, ads } = parsed.data;

  const admin = createAdminClient();

  // Confirm the job exists and belongs to the given user before writing.
  const { data: job } = await admin
    .from("jobs")
    .select("id, user_id, type")
    .eq("id", job_id)
    .single();
  if (!job || job.user_id !== user_id || job.type !== "scrape") {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  if (status === "failed") {
    await admin
      .from("jobs")
      .update({
        status: "failed",
        error_message: error ?? "Scrape failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job_id);
    return NextResponse.json({ ok: true });
  }

  const savedIds: string[] = [];
  for (const ad of ads) {
    let mediaStoragePath: string | null = null;

    // Re-host the creative — Meta CDN URLs expire within days.
    if (ad.media_url) {
      try {
        const res = await fetch(ad.media_url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const ext = ad.media_type === "video" ? "mp4" : "jpg";
          const path = `${user_id}/${job_id}-${savedIds.length}.${ext}`;
          const { error: uploadError } = await admin.storage
            .from("ad-media")
            .upload(path, buffer, {
              contentType:
                ad.media_type === "video" ? "video/mp4" : "image/jpeg",
              upsert: true,
            });
          if (!uploadError) mediaStoragePath = path;
        }
      } catch {
        // Keep the original URL as a fallback; the ad row is still useful.
      }
    }

    const { data: inserted } = await admin
      .from("saved_ads")
      .insert({
        user_id,
        meta_ad_id: ad.meta_ad_id ?? null,
        meta_page_name: ad.meta_page_name ?? null,
        meta_ad_library_url: ad.meta_ad_library_url ?? null,
        media_type: ad.media_type,
        media_storage_path: mediaStoragePath,
        original_media_url: ad.media_url ?? null,
        ad_copy: ad.ad_copy ?? null,
        cta_text: ad.cta_text ?? null,
        landing_page_url: ad.landing_page_url ?? null,
        metadata: ad.metadata,
      })
      .select("id")
      .single();
    if (inserted) savedIds.push(inserted.id);
  }

  await admin
    .from("jobs")
    .update({
      status: "completed",
      result: { saved_ad_ids: savedIds, count: savedIds.length },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job_id);

  return NextResponse.json({ ok: true, saved: savedIds.length });
}
