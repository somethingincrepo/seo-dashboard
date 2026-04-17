import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { PackageTier } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PACKAGE_PREFIXES: Record<PackageTier, string> = {
  starter: "STR",
  growth: "GRW",
  authority: "ATH",
};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous chars (no I/O/0/1)

function generateTokenString(tier: PackageTier): string {
  const prefix = PACKAGE_PREFIXES[tier];
  let suffix = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    suffix += CHARS[b % CHARS.length];
  }
  return `${prefix}-${suffix}`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { package_tier?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier = body.package_tier as PackageTier;
  if (!tier || !["starter", "growth", "authority"].includes(tier)) {
    return NextResponse.json({ error: "package_tier must be starter, growth, or authority" }, { status: 400 });
  }

  const token = generateTokenString(tier);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from("invite_tokens")
    .insert({
      token,
      package_tier: tier,
      created_by: session.username,
      notes: body.notes?.trim() || null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token: data }, { status: 201 });
}
