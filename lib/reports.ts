import { airtableFetch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type ReportFields = {
  // Identity
  client_id: string[];          // linked record array
  month: number;
  report_month_label: string;   // e.g. "March 2026"
  report_generated_at: string;  // ISO timestamp

  // Changes summary
  changes_made: number;
  changes_by_category: string;  // JSON: { Technical: N, "On-Page": N, Content: N, "AI-GEO": N }
  notable_changes: string;      // plain text, one change per line
  skipped_count: number;

  // GSC performance
  gsc_clicks_this: number | null;
  gsc_clicks_prior: number | null;
  gsc_clicks_delta: number | null;
  gsc_clicks_pct: string | null;       // e.g. "+12%"
  gsc_impressions_delta: number | null;
  gsc_avg_position_delta: number | null;
  top_ranking_gains: string | null;    // JSON array: [{ keyword, prior_position, current_position, change }]
  ranking_opportunities: string | null; // JSON array: [{ keyword, position, impressions }]

  // GA4 — overall traffic
  ga4_sessions_this: number | null;
  ga4_sessions_prior: number | null;
  ga4_sessions_delta: number | null;
  ga4_users_this: number | null;
  ga4_users_prior: number | null;
  ga4_users_delta: number | null;

  // GA4 — AI referral traffic (ChatGPT, Perplexity, Claude, Gemini, etc.)
  ga4_ai_sessions_this: number | null;
  ga4_ai_sessions_prior: number | null;
  ga4_ai_sessions_delta: number | null;
  ga4_ai_by_source: string | null;    // JSON array: [{ source, sessions_this, sessions_prior }]

  // Content
  content_queue: string | null;       // JSON array of top 5 pending content items

  // Planning
  next_month_priorities: string;      // plain text, numbered list
};

export type Report = AirtableRecord<ReportFields>;

const TABLE = "Reports";

export async function getClientReports(clientId: string): Promise<Report[]> {
  return airtableFetch<Report>(TABLE, {
    filterByFormula: `FIND("${clientId}",ARRAYJOIN({client_id}))`,
    sort: [{ field: "report_generated_at", direction: "desc" }],
  });
}

export async function getAllReports(): Promise<Report[]> {
  return airtableFetch<Report>(TABLE, {
    sort: [{ field: "report_generated_at", direction: "desc" }],
    maxRecords: 100,
  });
}
