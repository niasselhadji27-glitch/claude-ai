import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Clapperboard, Download } from "lucide-react";
import type { RenderedVideo, RenderStatus } from "@/lib/types";

const statusVariant: Record<
  RenderStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  draft: "secondary",
  queued: "secondary",
  rendering: "warning",
  completed: "success",
  failed: "destructive",
};

export default async function RendersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rendered_videos")
    .select("*, generated_scripts(title, variation_number)")
    .order("created_at", { ascending: false })
    .limit(50);

  const renders = (data ?? []) as (RenderedVideo & {
    generated_scripts: { title: string | null; variation_number: number } | null;
  })[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Renders</h1>
        <Link href="/renders/new">
          <Button>
            <Clapperboard className="h-4 w-4" /> New render
          </Button>
        </Link>
      </div>

      {renders.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-white py-24 text-center">
          <Clapperboard className="h-10 w-10 text-zinc-300" />
          <h2 className="mt-4 font-semibold">No renders yet</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Generate a script in the Script Studio, then render it into a
            finished video ad.
          </p>
          <Link href="/renders/new" className="mt-6">
            <Button>Create your first render</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {renders.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              {r.output_url && r.status === "completed" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={r.output_url} controls className="w-full bg-black" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-zinc-100">
                  <Clapperboard className="h-8 w-8 text-zinc-300" />
                </div>
              )}
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {r.generated_scripts?.title ??
                      `Variation ${r.generated_scripts?.variation_number ?? "?"}`}
                  </span>
                  <Badge variant={statusVariant[r.status]} className="capitalize">
                    {r.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatDate(r.created_at)}
                  {r.error_message ? ` — ${r.error_message}` : ""}
                </p>
                {r.output_url && r.status === "completed" && (
                  <a
                    href={r.output_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
