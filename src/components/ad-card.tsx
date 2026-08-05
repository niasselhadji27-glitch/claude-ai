import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { SavedAd } from "@/lib/types";
import { Film, Image as ImageIcon, Images } from "lucide-react";

const mediaIcons = { video: Film, image: ImageIcon, carousel: Images };

export function AdCard({
  ad,
  mediaUrl,
}: {
  ad: SavedAd;
  mediaUrl: string | null;
}) {
  const MediaIcon = mediaIcons[ad.media_type] ?? Film;

  return (
    <Link href={`/ads/${ad.id}`} className="block">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {mediaUrl ? (
          ad.media_type === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={mediaUrl}
              className="w-full bg-black"
              preload="metadata"
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt={ad.meta_page_name ?? "Saved ad"} className="w-full" />
          )
        ) : (
          <div className="flex h-40 items-center justify-center bg-zinc-100">
            <MediaIcon className="h-8 w-8 text-zinc-400" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">
              {ad.meta_page_name ?? "Unknown advertiser"}
            </span>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {ad.media_type}
            </Badge>
          </div>
          {ad.ad_copy && (
            <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{ad.ad_copy}</p>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Saved {formatDate(ad.created_at)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
