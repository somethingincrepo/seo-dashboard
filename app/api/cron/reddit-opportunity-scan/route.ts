import { NextRequest, NextResponse } from "next/server";
import { airtableFetch } from "@/lib/airtable";
import {
  searchRedditByKeyword,
  searchRedditMentions,
  scoreThread,
  upsertOpportunities,
  generateExplanations,
  type ScoredOpportunity,
} from "@/lib/reddit";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

type ClientRecord = {
  id: string;
  fields: {
    company_name?: string;
    plan_status?: string;
    keywords?: string;
    keyword_groups?: string;
    custom_keyword_groups?: string;
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

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const adminPass = process.env.ADMIN_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  const isAdmin = adminPass && auth === `Bearer ${adminPass}`;
  const isCronSecret = cronSecret && auth === `Bearer ${cronSecret}`;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (!isAdmin && !isCronSecret && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: Array<{ client: string; keyword?: string; error: string }> = [];
  let clientsProcessed = 0;
  let keywordsScanned = 0;
  let threadsUpserted = 0;

  let clients: ClientRecord[] = [];
  try {
    clients = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: `AND(OR({plan_status}="active",{plan_status}="month1_audit",{plan_status}="month1_audit_complete"),{portal_token}!="")`,
      fields: ["company_name", "plan_status", "keywords", "keyword_groups", "custom_keyword_groups"],
      maxRecords: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "clients fetch failed", message }, { status: 500 });
  }

  for (const client of clients) {
    const clientName = client.fields.company_name ?? client.id;
    const keywords = parseKeywords(client);
    if (keywords.length === 0) continue;
    clientsProcessed++;

    const allOpportunities: ScoredOpportunity[] = [];

    // ── Keyword search (SEO opportunities) ──────────────────────────────────
    for (const keyword of keywords) {
      try {
        const posts = await searchRedditByKeyword(keyword, { limit: 10 });
        keywordsScanned++;

        for (const post of posts) {
          const relevanceScore = scoreThread(post, keyword, true);
          if (relevanceScore < 10) continue;
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
        errors.push({ client: clientName, keyword, error: message });
        await delay(2000);
      }
    }

    // ── Brand mention search ─────────────────────────────────────────────────
    // Use a short brand name — strip common business suffixes and long descriptors
    const brandName = clientName
      .replace(/\b(LLC|Inc|Corp|Ltd|Charters?|&.*|Water Taxi|SF|AI|Co\.?)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");

    try {
      const mentionPosts = await searchRedditMentions(brandName || clientName, { limit: 10 });
      for (const post of mentionPosts) {
        const relevanceScore = Math.min(scoreThread(post, clientName, true) + 20, 100);
        allOpportunities.push({
          ...post,
          keyword: clientName,
          relevance_score: relevanceScore,
          ranks_on_google: true,
          opportunity_type: "mention",
          source: "dataforseo",
        });
      }
      await delay(2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ client: clientName, keyword: "brand mention", error: message });
    }

    if (allOpportunities.length === 0) continue;

    // ── Generate AI explanations (one batch Claude call per client) ──────────
    let explanations: Record<string, string> = {};
    try {
      explanations = await generateExplanations(
        allOpportunities.map(o => ({ id: o.id, title: o.title, selftext: o.selftext })),
        brandName || clientName,
        keywords
      );
    } catch { /* non-fatal — upsert without explanations */ }

    // ── Upsert ──────────────────────────────────────────────────────────────
    try {
      await upsertOpportunities(client.id, allOpportunities, explanations);
      threadsUpserted += allOpportunities.length;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ client: clientName, error: message });
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
