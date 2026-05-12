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

export type ScoredOpportunity = RedditPost & {
  keyword: string;
  relevance_score: number;
  ranks_on_google: boolean;
  source: "reddit_api" | "pullpush";
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
  status: "new" | "viewed" | "replied" | "dismissed";
  created_at: string;
  updated_at: string;
};

// ─── Search (DataForSEO Google SERP: site:reddit.com {keyword}) ───────────────
// Finds Reddit threads already ranking on Google — highest-value targets.
// Uses existing DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD credentials.

export async function searchRedditByKeyword(
  keyword: string,
  opts: { limit?: number } = {}
): Promise<RedditPost[]> {
  const { limit = 10 } = opts;
  const auth = getDataForSEOAuth();

  const res = await fetch(DATAFORSEO_SERP, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      keyword: `site:reddit.com ${keyword}`,
      location_code: 2840,
      language_code: "en",
      depth: limit,
      se_domain: "google.com",
    }]),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`DataForSEO search failed: ${res.status}`);

  const data = await res.json() as { tasks: Array<{ result: Array<{ items: Array<Record<string, unknown>> }> }> };
  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];

  const posts: RedditPost[] = [];
  for (const item of items) {
    if (item.type !== "organic") continue;
    const url = (item.url as string) ?? "";
    if (!url.includes("reddit.com/r/")) continue;

    // Extract Reddit post ID from URL: /r/sub/comments/ID/slug
    const match = url.match(/\/comments\/([a-z0-9]+)\//i);
    const id = match?.[1] ?? url;

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
      created_utc: Math.floor(Date.now() / 1000), // unknown, treat as fresh
    });
  }

  return posts;
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

// ─── Google ranking signal ────────────────────────────────────────────────────

export async function getGoogleRankingRedditUrls(keyword: string): Promise<Set<string>> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return new Set();

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", key);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", `site:reddit.com ${keyword}`);
    url.searchParams.set("num", "10");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return new Set();

    const data = await res.json() as { items?: Array<{ link: string }> };
    const urls = new Set<string>();
    for (const item of data.items ?? []) {
      urls.add(item.link.replace(/\?.*$/, "").replace(/\/$/, ""));
    }
    return urls;
  } catch {
    return new Set();
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function upsertOpportunities(
  clientId: string,
  opportunities: ScoredOpportunity[]
): Promise<{ inserted: number; updated: number }> {
  if (opportunities.length === 0) return { inserted: 0, updated: 0 };
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
    updated_at: new Date().toISOString(),
  }));

  // Pass 1: insert genuinely new rows only (status defaults to 'new')
  const { data: insertData, error: insertError } = await supabase
    .from("reddit_opportunities")
    .upsert(rows, { onConflict: "client_id,reddit_post_id", ignoreDuplicates: true })
    .select("id");
  if (insertError) throw new Error(`insert failed: ${insertError.message}`);
  const insertCount = insertData?.length ?? 0;

  // Pass 2: refresh mutable signal fields on existing rows (preserves status)
  let updateCount = 0;
  for (const row of rows) {
    const { error: updateError } = await supabase
      .from("reddit_opportunities")
      .update({
        upvotes: row.upvotes,
        num_comments: row.num_comments,
        relevance_score: row.relevance_score,
        ranks_on_google: row.ranks_on_google,
        scraped_at: row.scraped_at,
        updated_at: row.updated_at,
      })
      .eq("client_id", row.client_id)
      .eq("reddit_post_id", row.reddit_post_id)
      .neq("status", "dismissed");
    if (!updateError) updateCount++;
  }

  return { inserted: insertCount ?? 0, updated: updateCount };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listOpportunitiesForClient(
  clientId: string,
  opts: {
    status?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: RedditOpportunity[]; total: number }> {
  const { status, keyword, limit = 25, offset = 0 } = opts;
  const supabase = getSupabase();

  let q = supabase
    .from("reddit_opportunities")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .order("relevance_score", { ascending: false })
    .order("scraped_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq("status", status);
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
