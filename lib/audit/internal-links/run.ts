/**
 * High-level "run the deterministic internal-links pipeline" entry point.
 *
 * Consumed by:
 *   - The diagnose route (immediately after a fresh audit lands)
 *   - The /api/audit/internal-links/generate-batch endpoint (called weekly
 *     by the worker scheduler so the cadence matches everything else in the
 *     4-week delivery breakdown)
 *
 * The function is idempotent: it dedupes against existing pending/approved
 * Internal Link Changes, so re-running for the same client never produces
 * duplicate proposals.
 */

import { getSupabase } from "@/lib/supabase";
import { getClient } from "@/lib/clients";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { Page } from "@/lib/audit/rules/types";
import { generateProposals } from "./generator";
import { writeInternalLinkChanges } from "./changes-writer";

export interface RunInternalLinksInput {
  /** Airtable Clients record ID. */
  clientId: string;
  /**
   * If provided, use the pages crawled by this audit. If omitted, the most
   * recent successful audit run for the client is used (this is the weekly
   * cadence path).
   */
  auditRunId?: string;
  /**
   * Optional override of the package quota (used when the caller already
   * pre-computed how many new Changes the client should receive this batch).
   * Defaults to PACKAGES[<client_pkg>].internal_links — the full monthly
   * limit; the writer dedupes against existing rows.
   */
  quotaOverride?: number;
}

export interface RunInternalLinksResult {
  audit_run_id: string;
  pages_considered: number;
  /** How many of the pages have body_html populated (key diagnostic). */
  pages_with_html: number;
  /** Number of R047–R050 issues that drove generation (the "demand" side). */
  issues_seen: number;
  proposals_generated: number;
  proposal_failures: number;
  /** Per-issue failure reasons for observability. */
  failure_details?: Array<{ issue_id: string; rule_id: string; reason: string }>;
  changes_written: number;
  status: "complete" | "skipped" | "no_html";
  message?: string;
}

export async function runInternalLinksGeneration(
  input: RunInternalLinksInput,
): Promise<RunInternalLinksResult> {
  const supabase = getSupabase();
  const { clientId } = input;

  let auditRunId = input.auditRunId ?? null;
  if (!auditRunId) {
    const { data, error } = await supabase
      .from("audit_runs")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`audit_runs lookup failed: ${error.message}`);
    if (!data || data.length === 0) {
      const msg = "no completed audit_run found for client; skipping internal-links batch";
      console.log(`[internal-links] ${msg} (client=${clientId})`);
      return {
        audit_run_id: "",
        pages_considered: 0,
        pages_with_html: 0,
        issues_seen: 0,
        proposals_generated: 0,
        proposal_failures: 0,
        failure_details: [],
        changes_written: 0,
        status: "skipped",
        message: msg,
      };
    }
    auditRunId = data[0].id as string;
  }

  // Load all pages from the audit run.
  const { pages, htmlByUrl } = await loadAllPages(auditRunId);
  // Phase-0 trace: log how many pages have body_html so we can see the gap.
  console.log(`[internal-links] loaded ${pages.length} pages, ${htmlByUrl.size} with body_html (audit_run_id=${auditRunId})`);
  if (pages.length === 0) {
    const msg = "no pages found for audit_run";
    console.log(`[internal-links] ${msg} (audit_run_id=${auditRunId})`);
    return {
      audit_run_id: auditRunId,
      pages_considered: 0,
      pages_with_html: 0,
      issues_seen: 0,
      proposals_generated: 0,
      proposal_failures: 0,
      failure_details: [],
      changes_written: 0,
      status: "skipped",
      message: msg,
    };
  }

  // Find the issues for R047/R048/R049/R050 in this audit_run that drive
  // generation. If no issues exist (rare — fully linked site), short-circuit.
  const { data: issuesData, error: issuesErr } = await supabase
    .from("issues")
    .select("id, rule_id, page_id, page_url")
    .eq("audit_run_id", auditRunId)
    .in("rule_id", ["R047", "R048", "R049", "R050"]);
  if (issuesErr) throw new Error(`issues fetch failed: ${issuesErr.message}`);
  const issues = (issuesData ?? []) as Array<{
    id: string; rule_id: string; page_id: string | null; page_url: string | null;
  }>;
  if (issues.length === 0) {
    const msg = "no R047–R050 issues for this audit; site has no orphans, dead-ends, or buried pages";
    console.log(`[internal-links] ${msg} (audit_run_id=${auditRunId}, pages_considered=${pages.length})`);
    return {
      audit_run_id: auditRunId,
      pages_considered: pages.length,
      pages_with_html: htmlByUrl.size,
      issues_seen: 0,
      proposals_generated: 0,
      proposal_failures: 0,
      changes_written: 0,
      status: "complete",
      message: msg,
    };
  }

  // Load client metadata for brand + keyword candidates + package quota.
  let brand: string | null = null;
  const keywords: string[] = [];
  let pkg: PackageTier = "growth";
  try {
    const client = await getClient(clientId);
    if (client) {
      brand = client.fields.company_name ?? null;
      const rawPkg = (client.fields.package ?? "growth").toString().toLowerCase();
      if (rawPkg === "starter" || rawPkg === "growth" || rawPkg === "authority") pkg = rawPkg;
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
    }
  } catch (e) {
    console.warn("[run-internal-links] client load failed:", e instanceof Error ? e.message : String(e));
  }

  // Generate deterministic proposals using body HTML stored by the crawler.
  const result = await generateProposals({
    issues: issues.map((i) => ({ id: i.id, rule_id: i.rule_id, page_id: i.page_id, page_url: i.page_url })),
    pages,
    brand,
    keywords,
    htmlByUrl,
  });

  // Write proposals back to Supabase issues.proposed_value (one per issue,
  // with multiple proposals merged into a JSON array per issue).
  const byIssue = new Map<string, unknown[]>();
  for (const p of result.proposals) {
    if (!byIssue.has(p.issue_id)) byIssue.set(p.issue_id, []);
    byIssue.get(p.issue_id)!.push(p.proposal);
  }
  const nowIso = new Date().toISOString();
  const writes: Array<PromiseLike<unknown>> = [];
  for (const [issueId, props] of byIssue) {
    writes.push(
      supabase
        .from("issues")
        .update({
          proposed_value: JSON.stringify(props.length === 1 ? props[0] : props),
          fix_status: "generated",
          fix_generated_at: nowIso,
        })
        .eq("id", issueId),
    );
  }
  for (const f of result.failures) {
    writes.push(
      supabase
        .from("issues")
        .update({ fix_status: "failed", fix_error: f.reason })
        .eq("id", f.issue_id),
    );
  }
  const CHUNK = 25;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await Promise.all(writes.slice(i, i + CHUNK));
  }

  // Write client-facing Internal Link Change records to Airtable.
  const quota = input.quotaOverride ?? PACKAGES[pkg].internal_links;
  const writeRes = await writeInternalLinkChanges({
    clientId,
    auditRunId,
    proposals: result.proposals.map((p) => p.proposal),
    quota,
    nowIso,
  });

  const message =
    result.proposals.length === 0
      ? `${issues.length} R047–R050 issues but generator produced 0 proposals (pages_with_html=${htmlByUrl.size}/${pages.length})`
      : `${result.proposals.length} proposals generated → ${writeRes.written} Changes written`;
  // Surface 0-proposal state as a distinct status so health queries can catch it.
  const status: RunInternalLinksResult["status"] =
    htmlByUrl.size === 0 && issues.length > 0 ? "no_html"
    : "complete";
  console.log(
    `[internal-links] ${status} (audit_run_id=${auditRunId}, pages=${pages.length}, pages_with_html=${htmlByUrl.size}, issues=${issues.length}, proposals=${result.proposals.length}, failures=${result.failures.length}, changes=${writeRes.written})`,
  );
  return {
    audit_run_id: auditRunId,
    pages_considered: pages.length,
    pages_with_html: htmlByUrl.size,
    issues_seen: issues.length,
    proposals_generated: result.proposals.length,
    proposal_failures: result.failures.length,
    failure_details: result.failures.map((f) => {
      const issue = issues.find((i) => i.id === f.issue_id);
      return { issue_id: f.issue_id, rule_id: issue?.rule_id ?? "unknown", reason: f.reason };
    }),
    changes_written: writeRes.written,
    status,
    message,
  };
}

async function loadAllPages(
  auditRunId: string,
): Promise<{ pages: Page[]; htmlByUrl: Map<string, string> }> {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  const pages: Page[] = [];
  const htmlByUrl = new Map<string, string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("audit_run_id", auditRunId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`pages load failed: ${error.message}`);
    const rows = (data ?? []) as Array<Page & { body_html?: string | null }>;
    for (const row of rows) {
      pages.push(row as Page);
      if (row.body_html) htmlByUrl.set(row.url, row.body_html);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { pages, htmlByUrl };
}
