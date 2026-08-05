import { createClient } from "@/lib/supabase/server";
import { ScrapeForm } from "@/components/scrape-form";
import type { Job } from "@/lib/types";

export default async function ScrapePage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("type", "scrape")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Scrape Ads</h1>
      <ScrapeForm initialJobs={(jobs ?? []) as Job[]} />
    </div>
  );
}
