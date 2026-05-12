import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const DATAFORSEO_SERP = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

function getDataForSEOAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  return Buffer.from(`${login}:${password}`).toString("base64");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RedditPost = {
  id: string;
  fullname: string;
  title: string;
  url: string;
  permalink: string;
  selftext: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
};

export type OpportunityType = "keyword" | "mention";

export type ScoredOpportunity = RedditPost & {
  keyword: string;
  relevance_score: number;
  ranks_on_google: boolean;
  opportunity_type: OpportunityType;
  source: "dataforseo";
};

export type RedditOpportunity = {
  id: string;
  client_id: string;
  reddit_post_id: string;
  title: string;
  url: string;
  permalink: string;
  subreddit: string;
  keyword: string;
  upvotes: number;
  num_comments: number;
  created_utc: string;
  scraped_at: string;
  source: string;
  relevance_score: number;
  ranks_on_google: boolean;
  opportunity_type: OpportunityType;
  ai_explanation: string | null;
  status: "new" | "viewed" | "replied" | "dismissed";
  created_at: string;
  updated_at: string;
};

// ─── DataForSEO search helper ─────────────────────────────────────────────────

async function dataforSeoSearch(query: string, limit = 10): Promise<RedditPost[]> {
  const auth = getDataForSEOAuth();

  const res = await fetch(DATAFORSEO_SERP, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      keyword: query,
      location_code: 2840,
      language_code: "en",
      depth: limit,
      se_domain: "google.com",
    }]),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`DataForSEO search failed: ${res.status}`);

  const data = await res.json() as {
    tasks: Array<{ result: Array<{ items: Array<Record<string, unknown>> }> }>;
  };
  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];

  const posts: RedditPost[] = [];
  for (const item of items) {
    if (item.type !== "organic") continue;
    const url = (item.url as string) ?? "";
    if (!url.includes("reddit.com/r/")) continue;

    const match = url.match(/\/comments\/([a-z0-9]+)\//i);
    const id = match?.[1] ?? Buffer.from(url).toString("base64").slice(0, 8);

    posts.push({
      id,
      fullname: `t3_${id}`,
      title: (item.title as string) ?? "",
      url,
      permalink: url,
      selftext: (item.description as string) ?? "",
      subreddit: url.match(/\/r\/([^/]+)/)?.[1] ?? "",
      score: 0,
      num_comments: 0,
      created_utc: Math.floor(Date.now() / 1000),
    });
  }

  return posts;
}

// ─── Keyword search ───────────────────────────────────────────────────────────

export async function searchRedditByKeyword(
  keyword: string,
  opts: { limit?: number } = {}
): Promise<RedditPost[]> {
  return dataforSeoSearch(`site:reddit.com ${keyword}`, opts.limit ?? 10);
}

// ─── Brand mention search ─────────────────────────────────────────────────────

export async function searchRedditMentions(
  brandName: string,
  opts: { limit?: number } = {}
): Promise<RedditPost[]> {
  return dataforSeoSearch(`site:reddit.com "${brandName}"`, opts.limit ?? 10);
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function scoreThread(
  thread: RedditPost,
  keyword: string,
  ranksOnGoogle = false
): number {
  let score = 0;
  const ageDays = (Date.now() / 1000 - thread.created_utc) / 86400;

  if (ageDays <= 7) score += 25;
  else if (ageDays <= 30) score += 15;
  else if (ageDays <= 90) score += 8;

  if (thread.score >= 10) score += 20;
  if (thread.num_comments >= 5) score += 15;
  if (thread.title.toLowerCase().includes(keyword.toLowerCase())) score += 20;
  if (ranksOnGoogle) score += 30;

  return Math.min(score, 100);
}

// ─── AI Explanations (one batch call per client) ──────────────────────────────

export async function generateExplanations(
  threads: Array<{ id: string; title: string; selftext: string }>,
  brandName: string,
  keywords: string[]
): Promise<Record<string, string>> {
  if (threads.length === 0) return {};

  const client = new Anthropic();
  const keywordList = keywords.slice(0, 8).join(", ");

  const prompt = `You are analyzing Reddit threads for relevance to a brand.

Brand: ${brandName}
Keywords: ${keywordList}

For each thread below, write ONE sentence (max 20 words) explaining WHY it's relevant to this brand. Be specific. Focus on how the thread topic connects to the brand's offering.

Threads (JSON array):
${JSON.stringify(threads.map(t => ({ id: t.id, title: t.title, snippet: t.selftext.slice(0, 150) })))}

Return ONLY a JSON object mapping each thread id to its explanation string. Example:
{"abc123": "Users seeking alternatives to X — directly aligns with Brand's core value prop."}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]) as Record<string, string>;
  } catch {
    return {};
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function upsertOpportunities(
  clientId: string,
  opportunities: ScoredOpportunity[],
  explanations: Record<string, string> = {}
): Promise<void> {
  if (opportunities.length === 0) return;
  const supabase = getSupabase();

  const rows = opportunities.map((o) => ({
    client_id: clientId,
    reddit_post_id: o.fullname,
    title: o.title,
    url: o.url,
    permalink: o.permalink,
    subreddit: o.subreddit,
    keyword: o.keyword,
    upvotes: o.score,
    num_comments: o.num_comments,
    created_utc: new Date(o.created_utc * 1000).toISOString(),
    scraped_at: new Date().toISOString(),
    source: o.source,
    relevance_score: o.relevance_score,
    ranks_on_google: o.ranks_on_google,
    opportunity_type: o.opportunity_type,
    ai_explanation: explanations[o.id] ?? null,
    updated_at: new Date().toISOString(),
  }));

  // Insert new rows (status defaults to 'new', explanation stored)
  await supabase
    .from("reddit_opportunities")
    .upsert(rows, { onConflict: "client_id,reddit_post_id", ignoreDuplicates: true })
    .select("id");

  // Update mutable fields on existing rows (preserve status, update explanation if now available)
  for (const row of rows) {
    const updates: Record<string, unknown> = {
      upvotes: row.upvotes,
      num_comments: row.num_comments,
      relevance_score: row.relevance_score,
      ranks_on_google: row.ranks_on_google,
      scraped_at: row.scraped_at,
      updated_at: row.updated_at,
    };
    if (row.ai_explanation) updates.ai_explanation = row.ai_explanation;

    await supabase
      .from("reddit_opportunities")
      .update(updates)
      .eq("client_id", row.client_id)
      .eq("reddit_post_id", row.reddit_post_id)
      .neq("status", "dismissed");
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listOpportunitiesForClient(
  clientId: string,
  opts: {
    status?: string;
    opportunity_type?: OpportunityType;
    keyword?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: RedditOpportunity[]; total: number }> {
  const { status, opportunity_type, keyword, limit = 25, offset = 0 } = opts;
  const supabase = getSupabase();

  let q = supabase
    .from("reddit_opportunities")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .order("relevance_score", { ascending: false })
    .order("scraped_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq("status", status);
  if (opportunity_type) q = q.eq("opportunity_type", opportunity_type);
  if (keyword) q = q.eq("keyword", keyword);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as RedditOpportunity[], total: count ?? 0 };
}

export async function getOpportunityCountsByClient(): Promise<Record<string, number>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reddit_opportunities")
    .select("client_id")
    .eq("status", "new");
  if (error) return {};

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.client_id] = (counts[row.client_id] ?? 0) + 1;
  }
  return counts;
}

export async function updateOpportunityStatus(
  id: string,
  clientId: string,
  status: "viewed" | "replied" | "dismissed"
): Promise<void> {
  const { error } = await getSupabase()
    .from("reddit_opportunities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}
