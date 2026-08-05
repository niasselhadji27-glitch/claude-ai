import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RenderWizard } from "@/components/render-wizard";
import type { GeneratedScript, VoiceProfile } from "@/lib/types";

export default async function NewRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ script?: string }>;
}) {
  const { script } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: scripts }, { data: voices }] = await Promise.all([
    supabase
      .from("generated_scripts")
      .select("*, saved_ads(meta_page_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("voice_profiles").select("*").order("name"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New Render</h1>
      <RenderWizard
        scripts={
          (scripts ?? []) as (GeneratedScript & {
            saved_ads: { meta_page_name: string | null } | null;
          })[]
        }
        voices={(voices ?? []) as VoiceProfile[]}
        preselectedScriptId={script ?? null}
        userId={user.id}
      />
    </div>
  );
}
