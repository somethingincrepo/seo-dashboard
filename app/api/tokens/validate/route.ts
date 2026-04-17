import { NextRequest, NextResponse } from "next/server";
import { getSupabase, type InviteToken } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim().toUpperCase();

  if (!token) {
    return NextResponse.json({ valid: false, reason: "missing" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("invite_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  const row = data as InviteToken;

  if (row.used_at) {
    return NextResponse.json({ valid: false, reason: "used" });
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({ valid: true, package_tier: row.package_tier });
}
