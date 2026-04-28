import { getSupabase } from "@/lib/supabase";

export interface AuditRunSummary {
  id: string;
  client_id: string;
  client_name: string;
  root_url: string;
  status: string;
  triggered_by: string;
  pages_crawled: number;
  issues_found: number;
  crawl_started_at: string | null;
  crawl_completed_at: string | null;
  diagnose_started_at: string | null;
  diagnose_completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditIssue {
  id: string;
  audit_run_id: string;
  client_id: string;
  page_id: string | null;
  page_url: string | null;
  scope: "page" | "site";
  rule_id: string;
  rule_name: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "technical" | "on-page" | "content" | "ai-geo";
  current_value: string | null;
  expected_value: string | null;
  evidence: Record<string, unknown> | null;
  proposed_value: string | null;
  detected_at: string;
}

/** Latest audit_run for a client (any status). Returns null if none exist. */
export async function getLatestAuditRun(clientId: string): Promise<AuditRunSummary | null> {
  const { data } = await getSupabase()
    .from("audit_runs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as AuditRunSummary[];
  return rows[0] ?? null;
}

/** Latest *complete* audit_run; null if no completed run yet. Used for client-facing surfaces. */
export async function getLatestCompletedRun(clientId: string): Promise<AuditRunSummary | null> {
  const { data } = await getSupabase()
    .from("audit_runs")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as AuditRunSummary[];
  return rows[0] ?? null;
}

export async function getAuditRun(auditRunId: string): Promise<AuditRunSummary | null> {
  const { data } = await getSupabase()
    .from("audit_runs")
    .select("*")
    .eq("id", auditRunId)
    .single();
  return (data as AuditRunSummary) ?? null;
}

export async function listAuditRuns(limit = 200): Promise<AuditRunSummary[]> {
  const { data } = await getSupabase()
    .from("audit_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditRunSummary[];
}

export async function getIssuesForRun(auditRunId: string): Promise<AuditIssue[]> {
  const { data } = await getSupabase()
    .from("issues")
    .select("*")
    .eq("audit_run_id", auditRunId)
    .order("severity", { ascending: true })
    .order("rule_id", { ascending: true });
  return (data ?? []) as AuditIssue[];
}

/** Cheap count of issues for a client's latest complete run — used to badge the nav. */
export async function getLatestIssueCount(clientId: string): Promise<number> {
  const run = await getLatestCompletedRun(clientId);
  if (!run) return 0;
  return run.issues_found ?? 0;
}
