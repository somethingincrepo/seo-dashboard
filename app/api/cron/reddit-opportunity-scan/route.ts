import { NextRequest, NextResponse } from "next/server";
import { airtableFetch } from "@/lib/airtable";
import {
  searchRedditByKeyword,
  scoreThread,
  upsertOpportunities,
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

  // Primary: structured keyword_groups JSON
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

  // Fallback: plain keywords string field
  if (keywords.length === 0 && client.fields.keywords) {
    const plain = client.fields.keywords
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 2);
    keywords.push(...plain);
  }

  // Deduplicate and cap at 5 per client to stay within PullPush rate limits
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
    console.error("[reddit-scan] clients fetch failed:", message);
    return NextResponse.json({ error: "clients fetch failed", message }, { status: 500 });
  }

  for (const client of clients) {
    const clientName = client.fields.company_name ?? client.id;
    const keywords = parseKeywords(client);

    if (keywords.length === 0) continue;
    clientsProcessed++;

    const allOpportunities: ScoredOpportunity[] = [];

    for (const keyword of keywords) {
      try {
        // Search Google for site:reddit.com {keyword} via DataForSEO
        // All results already rank on Google — highest-value targets
        const posts = await searchRedditByKeyword(keyword, { limit: 10 });
        keywordsScanned++;

        for (const post of posts) {
          const relevanceScore = scoreThread(post, keyword, true); // all rank on Google
          if (relevanceScore < 10) continue;

          allOpportunities.push({
            ...post,
            keyword,
            relevance_score: relevanceScore,
            ranks_on_google: true,
            source: "reddit_api",
          });
        }

        // 4s delay between PullPush calls to respect rate limits
        await delay(4000);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[reddit-scan] ${clientName} / ${keyword}:`, message);
        errors.push({ client: clientName, keyword, error: message });
        await delay(4000);
      }
    }

    if (allOpportunities.length > 0) {
      try {
        await upsertOpportunities(client.id, allOpportunities);
        threadsUpserted += allOpportunities.length;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[reddit-scan] upsert failed for ${clientName}:`, message);
        errors.push({ client: clientName, error: message });
      }
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
