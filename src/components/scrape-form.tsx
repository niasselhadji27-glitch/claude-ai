"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Job, JobStatus } from "@/lib/types";

const statusVariant: Record<JobStatus, "secondary" | "warning" | "success" | "destructive"> = {
  queued: "secondary",
  processing: "warning",
  completed: "success",
  failed: "destructive",
};

export function ScrapeForm({ initialJobs }: { initialJobs: Job[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);

  // Poll active jobs every 5s
  useEffect(() => {
    const hasActive = jobs.some(
      (j) => j.status === "queued" || j.status === "processing"
    );
    if (!hasActive) return;
    const interval = setInterval(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("type", "scrape")
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) {
        setJobs(data as Job[]);
        if (
          (data as Job[]).every(
            (j) => j.status === "completed" || j.status === "failed"
          )
        ) {
          router.refresh();
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input.trim() }),
    });
    setLoading(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setInput("");
    setJobs((prev) => [body.job as Job, ...prev]);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Scrape Meta ads</CardTitle>
          <CardDescription>
            Paste a Meta Ad Library URL or type a competitor&apos;s page name.
            Costs 1 credit per scrape.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="query">Ad Library URL or competitor name</Label>
              <Input
                id="query"
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://www.facebook.com/ads/library/?id=… or “Glossier”"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Queuing…" : "Start scrape"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent scrape jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-zinc-100">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {String(job.input?.query ?? "Scrape job")}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatDate(job.created_at)}
                      {job.error_message ? ` — ${job.error_message}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant[job.status]} className="capitalize">
                    {job.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
