import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// DELETE /api/tokens/[token] — revoke (expire immediately)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;

  const { error } = await getSupabase()
    .from("invite_tokens")
    .update({ expires_at: new Date().toISOString() })
    .eq("token", token.toUpperCase())
    .is("used_at", null); // don't revoke already-used tokens

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
