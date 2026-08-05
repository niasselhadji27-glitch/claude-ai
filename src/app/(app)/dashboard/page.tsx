import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdCard } from "@/components/ad-card";
import { BoardFilter } from "@/components/board-filter";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { Board, SavedAd } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const { board } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: boards }, adsQuery] = await Promise.all([
    supabase.from("boards").select("*").order("created_at"),
    (() => {
      let q = supabase
        .from("saved_ads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (board) q = q.eq("board_id", board);
      return q;
    })(),
  ]);

  const ads = (adsQuery.data ?? []) as SavedAd[];

  // Signed URLs for re-hosted creatives (private bucket)
  const mediaUrls = new Map<string, string>();
  const paths = ads
    .filter((a) => a.media_storage_path)
    .map((a) => a.media_storage_path!) as string[];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("ad-media")
      .createSignedUrls(paths, 60 * 60);
    signed?.forEach((s) => {
      if (s.signedUrl && s.path) mediaUrls.set(s.path, s.signedUrl);
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Swipe File</h1>
          <p className="text-sm text-zinc-500">
            {ads.length} saved ad{ads.length === 1 ? "" : "s"}
            {user?.email ? ` · ${user.email}` : ""}
          </p>
        </div>
        <Link href="/scrape">
          <Button>
            <Search className="h-4 w-4" /> Scrape new ads
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <Suspense>
          <BoardFilter boards={(boards ?? []) as Board[]} />
        </Suspense>
      </div>

      {ads.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-white py-24 text-center">
          <Search className="h-10 w-10 text-zinc-300" />
          <h2 className="mt-4 font-semibold">Your swipe file is empty</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Scrape your first competitor ad from the Meta Ad Library to get
            started.
          </p>
          <Link href="/scrape" className="mt-6">
            <Button>Scrape your first ad</Button>
          </Link>
        </div>
      ) : (
        <div className="masonry">
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              mediaUrl={
                ad.media_storage_path
                  ? (mediaUrls.get(ad.media_storage_path) ?? null)
                  : (ad.original_media_url ?? null)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
