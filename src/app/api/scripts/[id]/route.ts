import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  content: z.string().min(1).max(10000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  // RLS restricts the update to the user's own rows.
  const { data, error } = await supabase
    .from("generated_scripts")
    .update({ content: parsed.data.content, is_edited: true })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json({ script: data });
}
