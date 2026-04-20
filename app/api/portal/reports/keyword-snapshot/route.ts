import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { executeDataforSeoKeywordInfo } from "@/lib/tools/dataforseo";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const REFRESH_COOLDOWN_DAYS = 3;

type KeywordRow = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
};

type Snapshot = {
  has_data: boolean;
  can_refresh: boolean;
  days_until_refresh: number;
  refreshed_at: string | null;
  keywords: KeywordRow[];
};

async function getSnapshot(clientId: string): Promise<Snapshot> {
  const { data } = await getSupabase()
    .from("keyword_snapshots")
    .select("keywords, refreshed_at")
    .eq("client_id", clientId)
    .single();

  if (!data) {
    return { has_data: false, can_refresh: true, days_until_refresh: 0, refreshed_at: null, keywords: [] };
  }

  const ageMs = Date.now() - new Date(data.refreshed_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const canRefresh = ageDays >= REFRESH_COOLDOWN_DAYS;
  const daysUntilRefresh = canRefresh ? 0 : Math.ceil(REFRESH_COOLDOWN_DAYS - ageDays);

  return {
    has_data: true,
    can_refresh: canRefresh,
    days_until_refresh: daysUntilRefresh,
    refreshed_at: data.refreshed_at,
    keywords: (data.keywords as KeywordRow[]) ?? [],
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const clientId = client.fields.client_id || client.id;
  return NextResponse.json(await getSnapshot(clientId));
}

export async function POST(request: NextRequest) {
  try {
    let body: { token?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const token = body.token;
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const client = await getClientByToken(token);
    if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const clientId = client.fields.client_id || client.id;

    // Check cooldown
    const existing = await getSnapshot(clientId);
    if (existing.has_data && !existing.can_refresh) {
      return NextResponse.json(
        { error: "too_fresh", days_until_refresh: existing.days_until_refresh, refreshed_at: existing.refreshed_at },
        { status: 409 }
      );
    }

    // Parse keywords from client record (comma-separated)
    const rawKeywords = client.fields.keywords ?? "";
    const keywords = rawKeywords
      .split(",")
      .map((k: string) => k.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (keywords.length === 0) {
      return NextResponse.json({ error: "No keywords configured for this client" }, { status: 422 });
    }

    // Fetch DataForSEO data for each keyword (sequential to avoid rate limits)
    const results: KeywordRow[] = [];
    for (const keyword of keywords) {
      try {
        const info = await executeDataforSeoKeywordInfo({ keyword });
        results.push({
          keyword: info.keyword,
          volume: info.volume,
          difficulty: info.difficulty,
          intent: info.intent,
        });
      } catch (err) {
        console.warn(`[keyword-snapshot] Failed for "${keyword}":`, err);
        results.push({ keyword, volume: 0, difficulty: 0, intent: "" });
      }
    }

    const now = new Date().toISOString();

    // Upsert into keyword_snapshots
    const { error: upsertError } = await getSupabase()
      .from("keyword_snapshots")
      .upsert(
        { client_id: clientId, keywords: results, refreshed_at: now },
        { onConflict: "client_id" }
      );

    if (upsertError) {
      console.error("[keyword-snapshot] Upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
    }

    return NextResponse.json({
      has_data: true,
      can_refresh: false,
      days_until_refresh: REFRESH_COOLDOWN_DAYS,
      refreshed_at: now,
      keywords: results,
    });
  } catch (err) {
    console.error("[keyword-snapshot] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
