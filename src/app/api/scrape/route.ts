import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spendCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/types";

const bodySchema = z.object({
  query: z.string().min(2).max(500),
});

/**
 * Enqueue a scrape job and dispatch it to the Python scraper service.
 * The service works asynchronously and posts results back to
 * /api/scrape/callback.
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
    return NextResponse.json(
      { error: "Enter an Ad Library URL or a competitor name." },
      { status: 400 }
    );
  }
  const query = parsed.data.query;

  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .insert({
      user_id: user.id,
      type: "scrape",
      status: "queued",
      input: { query },
    })
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Could not create job" }, { status: 500 });
  }

  const ok = await spendCredits(user.id, CREDIT_COSTS.scrape, "scrape", job.id);
  if (!ok) {
    await admin
      .from("jobs")
      .update({ status: "failed", error_message: "Insufficient credits" })
      .eq("id", job.id);
    return NextResponse.json(
      { error: "You're out of credits. Upgrade your plan in Settings." },
      { status: 402 }
    );
  }

  const scraperUrl = process.env.SCRAPER_SERVICE_URL;
  if (!scraperUrl) {
    await admin
      .from("jobs")
      .update({
        status: "failed",
        error_message: "Scraper service is not configured",
      })
      .eq("id", job.id);
    return NextResponse.json(
      { error: "Scraper service is not configured yet." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${scraperUrl}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.SCRAPER_API_KEY ?? "",
      },
      body: JSON.stringify({
        job_id: job.id,
        user_id: user.id,
        query,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/scrape/callback`,
      }),
    });
    if (!res.ok) throw new Error(`Scraper responded ${res.status}`);
    await admin.from("jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);
  } catch (err) {
    await admin
      .from("jobs")
      .update({
        status: "failed",
        error_message:
          err instanceof Error ? err.message : "Failed to reach scraper",
      })
      .eq("id", job.id);
    return NextResponse.json(
      { error: "The scraper service is unreachable. Try again shortly." },
      { status: 502 }
    );
  }

  const { data: freshJob } = await admin
    .from("jobs")
    .select("*")
    .eq("id", job.id)
    .single();

  return NextResponse.json({ job: freshJob ?? job });
}
