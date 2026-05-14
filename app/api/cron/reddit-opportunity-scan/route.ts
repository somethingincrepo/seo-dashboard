import { NextRequest, NextResponse } from "next/server";
import { airtableFetch } from "@/lib/airtable";
import { verifyBearer } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  searchRedditByKeyword,
  searchRedditMentions,
  scoreThread,
  upsertOpportunities,
  generateExplanations,
  type ScoredOpportunity,
} from "@/lib/reddit";
import { getWeeklyTargets, type PackageTier } from "@/lib/packages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ClientRecord = {
  id: string;
  fields: {
    company_name?: string;
    plan_status?: string;
    keywords?: string;
    keyword_groups?: string;
    custom_keyword_groups?: string;
    package?: string;
  };
};

function parseKeywords(client: ClientRecord): string[] {
  const keywords: string[] = [];

  for (const raw of [client.fields.keyword_groups, client.fields.custom_keyword_groups]) {
    if (!raw) continue;
    try {
      const groups = JSON.parse(raw) as Array<{ subkeywords?: Array<{ keyword?: string }> }>;
      for (const g of groups) {
        for (const sk of g.subkeywords ?? []) {
          if (sk.keyword) keywords.push(sk.keyword);
        }
      }
    } catch { /* ignore malformed JSON */ }
  }

  if (keywords.length === 0 && client.fields.keywords) {
    const plain = client.fields.keywords
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 2);
    keywords.push(...plain);
  }

  return [...new Set(keywords)].slice(0, 5);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Shared per-client scan logic ─────────────────────────────────────────────

async function runClientScan(
  client: ClientRecord,
  maxOpportunities: number,
): Promise<{ keywords_scanned: number; threads_upserted: number; errors: Array<{ keyword?: string; error: string }> }> {
  const clientName = client.fields.company_name ?? client.id;
  const keywords = parseKeywords(client);

  const errors: Array<{ keyword?: string; error: string }> = [];
  const allOpportunities: ScoredOpportunity[] = [];

  // ── Keyword search (SEO opportunities) ──────────────────────────────────
  for (const keyword of keywords) {
    try {
      const posts = await searchRedditByKeyword(keyword, { limit: 10 });

      for (const post of posts) {
        const relevanceScore = scoreThread(post, keyword, true);
        if (relevanceScore < 30) continue;
        allOpportunities.push({
          ...post,
          keyword,
          relevance_score: relevanceScore,
          ranks_on_google: true,
          opportunity_type: "keyword",
          source: "dataforseo",
        });
      }

      await delay(2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ keyword, error: message });
      await delay(2000);
    }
  }

  // ── Brand mention search ─────────────────────────────────────────────────
  const brandName = clientName
    .replace(/\b(LLC|Inc|Corp|Ltd|Charters?|&.*|Water Taxi|SF|AI|Co\.?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");

  try {
    const mentionPosts = await searchRedditMentions(brandName || clientName, { limit: 10 });
    const searchTerm = (brandName || clientName).toLowerCase();
    for (const post of mentionPosts) {
      // Only label as "mention" if the brand name actually appears in the
      // thread title or snippet — DataForSEO returns Google SERP results where
      // the brand may appear only in the URL or site-level description.
      const titleLower = post.title.toLowerCase();
      const snippetLower = post.selftext.toLowerCase();
      const hasBrandMention = titleLower.includes(searchTerm) || snippetLower.includes(searchTerm);
      if (!hasBrandMention) continue;

      const relevanceScore = Math.min(scoreThread(post, clientName, true) + 20, 100);
      allOpportunities.push({
        ...post,
        keyword: brandName || clientName,
        relevance_score: relevanceScore,
        ranks_on_google: true,
        opportunity_type: "mention",
        source: "dataforseo",
      });
    }
    await delay(2000);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push({ keyword: "brand mention", error: message });
  }

  if (allOpportunities.length === 0) {
    return { keywords_scanned: keywords.length, threads_upserted: 0, errors };
  }

  // ── Cap by weekly package quota (best by relevance_score) ────────────────
  const capped = allOpportunities
    .slice()
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, maxOpportunities);

  // ── Generate AI explanations (one batch Claude call per client) ──────────
  let explanations: Record<string, string> = {};
  try {
    explanations = await generateExplanations(
      capped.map(o => ({ id: o.id, title: o.title, selftext: o.selftext })),
      brandName || clientName,
      keywords,
    );
  } catch { /* non-fatal — upsert without explanations */ }

  // ── Upsert ──────────────────────────────────────────────────────────────
  try {
    await upsertOpportunities(client.id, capped, explanations);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push({ error: message });
  }

  return { keywords_scanned: keywords.length, threads_upserted: capped.length, errors };
}

function isAuthorized(request: NextRequest): boolean {
  const adminPass = process.env.ADMIN_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  const crawlerToken = process.env.CRAWLER_SERVICE_TOKEN;
  return (
    (adminPass ? verifyBearer(request, adminPass) : false) ||
    (cronSecret ? verifyBearer(request, cronSecret) : false) ||
    (crawlerToken ? verifyBearer(request, crawlerToken) : false) ||
    request.headers.get("x-vercel-cron") === "1"
  );
}

// ── POST — per-client, called by Fly worker via DETERMINISTIC_SOPS ───────────

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { client_id?: string; package?: string };
  try {
    body = (await request.json()) as { client_id?: string; package?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { client_id } = body;
  if (!client_id) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  // Guard: skip Reddit scanning until the client has at least one completed audit.
  // Without an audit the client's keyword/brand data may be incomplete or incorrect
  // (e.g. company_name still "Test" from a test form submission).
  const { data: completedAudits } = await getSupabase()
    .from("audit_runs")
    .select("id")
    .eq("client_id", client_id)
    .eq("status", "complete")
    .limit(1);
  if (!completedAudits || completedAudits.length === 0) {
    console.log(`[reddit-scan] client ${client_id} has no completed audit — skipping scan`);
    return NextResponse.json({ ok: true, client_id, skipped: true, reason: "no_completed_audit" });
  }

  let clients: ClientRecord[] = [];
  try {
    clients = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: `RECORD_ID()="${client_id}"`,
      fields: ["company_name", "plan_status", "keywords", "keyword_groups", "custom_keyword_groups", "package"],
      maxRecords: 1,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "clients fetch failed", message }, { status: 500 });
  }

  if (!clients.length) {
    return NextResponse.json({ error: "client not found" }, { status: 404 });
  }

  // Always derive the quota from the client's actual package tier (Airtable is source of truth).
  // Callers don't need to pass package — the endpoint reads it directly.
  const tier = (clients[0].fields.package as PackageTier | undefined) ?? "starter";
  const maxOpportunities = getWeeklyTargets(tier).reddit_comments;

  const result = await runClientScan(clients[0], maxOpportunities);
  return NextResponse.json({ ok: true, client_id, tier, max_opportunities: maxOpportunities, ...result });
}

// ── GET — all-clients admin / legacy cron (kept for manual triggers) ─────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: Array<{ client: string; keyword?: string; error: string }> = [];
  let clientsProcessed = 0;
  let keywordsScanned = 0;
  let threadsUpserted = 0;

  const { searchParams } = new URL(request.url);
  const singleClientId = searchParams.get("client_id");
  const filterFormula = singleClientId
    ? `RECORD_ID()="${singleClientId}"`
    : `AND(OR({plan_status}="active",{plan_status}="month1_audit",{plan_status}="month1_audit_complete"),{portal_token}!="")`;

  let clients: ClientRecord[] = [];
  try {
    clients = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: filterFormula,
      fields: ["company_name", "plan_status", "keywords", "keyword_groups", "custom_keyword_groups", "package"],
      maxRecords: singleClientId ? 1 : 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "clients fetch failed", message }, { status: 500 });
  }

  for (const client of clients) {
    const keywords = parseKeywords(client);
    if (keywords.length === 0) continue;

    // Same guard as POST: skip until at least one audit has completed.
    const { data: audits } = await getSupabase()
      .from("audit_runs")
      .select("id")
      .eq("client_id", client.id)
      .eq("status", "complete")
      .limit(1);
    if (!audits || audits.length === 0) {
      console.log(`[reddit-scan] client ${client.id} (${client.fields.company_name ?? ""}) has no completed audit — skipping`);
      continue;
    }

    clientsProcessed++;

    const tier = (client.fields.package as PackageTier | undefined) ?? "starter";
    const maxOpportunities = getWeeklyTargets(tier).reddit_comments;

    const result = await runClientScan(client, maxOpportunities);
    keywordsScanned += result.keywords_scanned;
    threadsUpserted += result.threads_upserted;
    for (const e of result.errors) {
      errors.push({ client: client.fields.company_name ?? client.id, ...e });
    }
  }

  return NextResponse.json({
    ok: true,
    clients_processed: clientsProcessed,
    keywords_scanned: keywordsScanned,
    threads_upserted: threadsUpserted,
    errors: errors.length > 0 ? errors : undefined,
  });
}
