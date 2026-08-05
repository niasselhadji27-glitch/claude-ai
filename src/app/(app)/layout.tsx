import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import type { Profile } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        email={user.email ?? ""}
        credits={profile?.credits_balance ?? 0}
        tier={profile?.subscription_tier ?? "free"}
      />
      <main className="flex-1 overflow-x-hidden bg-zinc-50 p-8">{children}</main>
    </div>
  );
}
