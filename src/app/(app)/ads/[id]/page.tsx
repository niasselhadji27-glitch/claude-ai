import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScriptStudio } from "@/components/script-studio";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { GeneratedScript, SavedAd } from "@/lib/types";

export default async function AdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ad }, { data: scripts }] = await Promise.all([
    supabase.from("saved_ads").select("*").eq("id", id).single<SavedAd>(),
    supabase
      .from("generated_scripts")
      .select("*")
      .eq("saved_ad_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!ad) notFound();

  let mediaUrl: string | null = ad.original_media_url;
  if (ad.media_storage_path) {
    const { data: signed } = await supabase.storage
      .from("ad-media")
      .createSignedUrl(ad.media_storage_path, 60 * 60);
    if (signed?.signedUrl) mediaUrl = signed.signedUrl;
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to swipe file
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {ad.meta_page_name ?? "Saved ad"}
        </h1>
        <Badge variant="secondary" className="capitalize">
          {ad.media_type}
        </Badge>
        {ad.meta_ad_library_url && (
          <a
            href={ad.meta_ad_library_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 underline hover:text-zinc-900"
          >
            View in Ad Library <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {mediaUrl && ad.media_type === "video" && (
        <div className="mb-6 max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={mediaUrl} controls className="w-full" />
        </div>
      )}
      {mediaUrl && ad.media_type !== "video" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt=""
          className="mb-6 max-w-md rounded-xl border border-zinc-200"
        />
      )}

      <ScriptStudio
        ad={ad}
        initialScripts={(scripts ?? []) as GeneratedScript[]}
      />
    </div>
  );
}
