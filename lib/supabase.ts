import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type JobStatus = "pending" | "claimed" | "running" | "done" | "failed";
export type LogLevel = "info" | "warn" | "error" | "debug";

export type JobRunner = "vercel" | "fly";

export type SupabaseJob = {
  id: string;
  sop_name: string;
  client_id: string | null;
  status: JobStatus;
  runner: JobRunner;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string | null;
  parent_job_id: string | null;
  worker_leased_until: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type JobLog = {
  id: number;
  job_id: string;
  level: LogLevel;
  message: string;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

let _client: Client | null = null;

export function getSupabase(): Client {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Typed helpers so callers get proper types without fighting Supabase generics

export async function getJob(id: string): Promise<SupabaseJob | null> {
  const { data, error } = await getSupabase().from("jobs").select("*").eq("id", id).single();
  if (error) return null;
  return data as SupabaseJob;
}

export async function listJobs(limit = 100): Promise<SupabaseJob[]> {
  const { data } = await getSupabase()
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SupabaseJob[];
}

export async function listLogs(jobId: string, after = 0): Promise<JobLog[]> {
  const { data } = await getSupabase()
    .from("job_logs")
    .select("*")
    .eq("job_id", jobId)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(200);
  return (data ?? []) as JobLog[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type RankingEntry = { keyword: string; prior_position: number; current_position: number; change: number };
export type PageEntry = { page: string; clicks_this: number; clicks_prior: number; delta: number };
export type TrendEntry = { month_label: string; clicks: number; impressions: number; avg_position: number };
export type AiSourceEntry = { source: string; sessions_this: number; sessions_prior: number };
export type ArticleEntry = { title: string; keyword: string; url?: string; ranking_position?: number | null };
export type RankingArticle = { title: string; keyword: string; position: number; impressions: number };
export type FaqPage = { page: string; question_count: number };
export type QueueItem = { title: string; keyword: string; status: string };
export type AiMention = { platform: string; context: string };
export type PageOptimized = { page: string; before_title?: string; after_title?: string; before_h1?: string; after_h1?: string };
export type KeywordEntry = { keyword: string; position: number };

export type SupabaseReport = {
  id: string;
  client_id: string;
  month: number;
  report_month_label: string;
  report_generated_at: string;

  // Changes
  changes_made: number;
  changes_by_category: Record<string, number> | null;
  notable_changes: string | null;
  skipped_count: number;
  pages_optimized: PageOptimized[] | null;
  schema_types_added: string[] | null;
  internal_links_added: number | null;
  approval_queue_status: { approved: number; live: number; pending: number; skipped: number; pending_14days: number } | null;

  // GSC
  gsc_clicks_this: number | null;
  gsc_clicks_prior: number | null;
  gsc_clicks_delta: number | null;
  gsc_clicks_pct: string | null;
  gsc_impressions_this: number | null;
  gsc_impressions_prior: number | null;
  gsc_impressions_delta: number | null;
  gsc_avg_position_this: number | null;
  gsc_avg_position_prior: number | null;
  gsc_avg_position_delta: number | null;
  gsc_ctr_this: number | null;
  gsc_ctr_prior: number | null;
  gsc_3month_trend: TrendEntry[] | null;
  top_ranking_gains: RankingEntry[] | null;
  top_ranking_losses: RankingEntry[] | null;
  new_top_20_keywords: KeywordEntry[] | null;
  top_1_3_keywords: KeywordEntry[] | null;
  top_pages_growth: PageEntry[] | null;
  top_pages_loss: PageEntry[] | null;

  // GA4
  ga4_sessions_this: number | null;
  ga4_sessions_prior: number | null;
  ga4_sessions_delta: number | null;
  ga4_users_this: number | null;
  ga4_users_prior: number | null;
  ga4_users_delta: number | null;
  ga4_ai_sessions_this: number | null;
  ga4_ai_sessions_prior: number | null;
  ga4_ai_sessions_delta: number | null;
  ga4_ai_by_source: AiSourceEntry[] | null;

  // Content
  articles_published: ArticleEntry[] | null;
  articles_now_ranking: RankingArticle[] | null;
  faqs_live: FaqPage[] | null;
  content_in_queue: QueueItem[] | null;

  // AI/GEO
  ai_mentions: AiMention[] | null;
  entity_coverage_score: number | null;
  entity_coverage_prior: number | null;
  faq_schema_coverage_pct: number | null;

  // Summary
  narrative: string | null;
  next_month_priorities: string | null;

  created_at: string;
};

export async function getClientReportsFromSupabase(clientId: string): Promise<SupabaseReport[]> {
  const { data } = await getSupabase()
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("report_generated_at", { ascending: false })
    .limit(24);
  return (data ?? []) as SupabaseReport[];
}

// ─── Invite Tokens ────────────────────────────────────────────────────────────

export type PackageTier = "starter" | "growth" | "authority";

export type InviteToken = {
  id: string;
  token: string;
  package_tier: PackageTier;
  created_by: string | null;
  notes: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_client_id: string | null;
  created_at: string;
};

export async function getAllReportsFromSupabase(limit = 100): Promise<SupabaseReport[]> {
  const { data } = await getSupabase()
    .from("reports")
    .select("*")
    .order("report_generated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SupabaseReport[];
}

// ─── GSC Snapshots ────────────────────────────────────────────────────────────

export type GscSnapshotQuery = { query: string; clicks: number; impressions: number; position: number };

export type GscSnapshot = {
  id: number;
  client_id: string;
  week_start: string;
  clicks: number;
  impressions: number;
  avg_position: number | null;
  ctr: number | null;
  top_queries: GscSnapshotQuery[];
  created_at: string;
  updated_at: string;
};

// Returns the ISO Monday (YYYY-MM-DD) for any given date
export function isoWeekMonday(date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

// Upsert one week's GSC data for a client. Fire-and-forget safe — errors are caught internally.
export async function upsertGscSnapshot(
  clientId: string,
  weekStart: string,
  data: { clicks: number; impressions: number; avg_position: number; ctr: number; top_queries: GscSnapshotQuery[] }
): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from("gsc_snapshots")
      .upsert(
        {
          client_id: clientId,
          week_start: weekStart,
          clicks: data.clicks,
          impressions: data.impressions,
          avg_position: data.avg_position,
          ctr: data.ctr,
          top_queries: data.top_queries,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,week_start" }
      );
    if (error) console.warn("[gsc_snapshots] upsert error:", error.message);
  } catch (e) {
    console.warn("[gsc_snapshots] upsert threw:", e);
  }
}

// Retrieve the last N weekly snapshots for a client, newest first
export async function getGscSnapshots(clientId: string, weeks = 12): Promise<GscSnapshot[]> {
  const { data } = await getSupabase()
    .from("gsc_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .order("week_start", { ascending: false })
    .limit(weeks);
  return (data ?? []) as GscSnapshot[];
}
