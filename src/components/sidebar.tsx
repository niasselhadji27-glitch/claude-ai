"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  Search,
  Clapperboard,
  Settings,
  LogOut,
  Coins,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Swipe File", icon: LayoutGrid },
  { href: "/scrape", label: "Scrape Ads", icon: Search },
  { href: "/renders", label: "Renders", icon: Clapperboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  email,
  credits,
  tier,
}: {
  email: string;
  credits: number;
  tier: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="px-5 py-6">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          AdVault Studio
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(link.href)
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-zinc-600">
            <Coins className="h-4 w-4" />
            {credits} credits
          </span>
          <Badge variant="secondary" className="capitalize">
            {tier}
          </Badge>
        </div>
        <p className="truncate text-xs text-zinc-500">{email}</p>
        <button
          onClick={signOut}
          className="mt-2 flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-900"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
