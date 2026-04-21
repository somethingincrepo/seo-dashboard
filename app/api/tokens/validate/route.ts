import { NextRequest, NextResponse } from "next/server";
import { getSupabase, type InviteToken } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ valid: false, reason: "rate_limited" }, { status: 429 });
  }
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
