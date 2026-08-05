import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid board name" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("boards")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "Board already exists" : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ board: data });
}
