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

// ---------------------------------------------------------------------------
// Live-fetch fallback for pages missing stored body_html
//
// The crawler stores stripped body HTML in pages.body_html since 2026-05-14.
// Pages from earlier audits have body_html = NULL. For those pages, fetch
// the HTML live with a short timeout and strip noise elements, matching the
// crawler's preprocessing. This fallback is only active when the stored
// column is empty; once pages are re-crawled it becomes a no-op.
// ---------------------------------------------------------------------------

const LIVE_FETCH_TIMEOUT_MS = 12_000;
const LIVE_FETCH_MAX_BYTES = 500 * 1024;

async function fetchHtmlForUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SomethingIncBot/1.0; internal-link-generator)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const raw = await res.text();
    // Respect size cap — same as crawler extractor
    if (Buffer.byteLength(raw, "utf8") > LIVE_FETCH_MAX_BYTES) return "";
    return raw;
  } catch {
    return "";
  }
}

/**
 * Strip nav/header/footer/script/style from raw HTML — mirrors the crawler's
 * cheerio stripping so the text content is comparable. Uses a simple regex
 * approach to avoid a cheerio import in the generator path.
 */
function stripNoiseElements(html: string): string {
  // Remove entire tag trees for noise elements. This is a best-effort strip
  // suitable for the internal-link scanner; the crawler's cheerio version
  // is more accurate but not importable here without a build dependency.
  return html
    .replace(/<(script|style|noscript|nav|header|footer|aside|iframe|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|noscript|nav|header|footer|aside|iframe|svg|template)[^>]*\/>/gi, "");
}

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
  /**
   * - "complete":  proposals were generated (or no issues exist)
   * - "skipped":   no pages / no audit run — didn't run at all
   * - "no_html":   pages exist and issues exist but body_html is 0 everywhere
   *               (JS-only site — Wix, heavy SPA — live-fetch fallback also failed)
   * - "no_match":  HTML is available and issues exist but no phrase in any issue
   *               target appears in any source page's prose (e.g. Shopify stores
   *               where product names only appear as link anchors)
   * "no_html" and "no_match" are delivery failures: issues were detected but
   * no proposals were produced. They must not be returned as "complete".
   */
  status: "complete" | "skipped" | "no_html" | "no_match";
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

  let message: string;
  if (result.proposals.length > 0) {
    message = `${result.proposals.length} proposals generated → ${writeRes.written} Changes written`;
  } else if (htmlByUrl.size === 0) {
    message = `${issues.length} R047–R050 issues detected but 0 pages have body_html — site may be JS-only (Wix/SPA); live-fetch fallback also produced no usable HTML. Proposals will generate after next Playwright crawl.`;
  } else {
    message = `${issues.length} R047–R050 issues detected, ${htmlByUrl.size}/${pages.length} pages with HTML, but no phrase from any issue target appears in any source page prose. Common cause: product-grid sites (Shopify) where product names appear only as link anchors, which the scanner skips to avoid link-in-link.`;
  }
  // Classify the outcome:
  // - no_html:   pages exist, issues exist, but no HTML even after live-fetch
  //             (JS-only sites like Wix where server HTML has no content)
  // - no_match:  HTML was available but no phrase matched anywhere
  //             (sparse prose or product-grid-dominated sites like Shopify)
  // - complete:  proposals generated, or no issues detected (nothing to do)
  const status: RunInternalLinksResult["status"] =
    issues.length > 0 && result.proposals.length === 0
      ? htmlByUrl.size === 0
        ? "no_html"
        : "no_match"
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

  // Live-fetch fallback: for pages missing body_html (crawled before the
  // column was added on 2026-05-14), fetch and strip HTML live. Only fetch
  // pages that are usable as source candidates (status_code=200, indexable,
  // word_count>=100) to avoid wasting fetches on redirects and thin pages.
  // Cap at 20 fetches per run to keep latency bounded; further pages skip.
  const MAX_LIVE_FETCHES = 20;
  let liveFetchCount = 0;
  if (htmlByUrl.size === 0 && pages.length > 0) {
    console.log(`[internal-links] body_html missing for all ${pages.length} pages — attempting live-fetch fallback`);
    const fetchTargets = pages.filter(
      (p) => p.status_code === 200 && p.is_indexable !== false && (p.word_count ?? 0) >= 100,
    );
    for (const page of fetchTargets) {
      if (liveFetchCount >= MAX_LIVE_FETCHES) break;
      const raw = await fetchHtmlForUrl(page.url);
      if (!raw) continue;
      const stripped = stripNoiseElements(raw);
      if (stripped.length > 0) {
        htmlByUrl.set(page.url, stripped);
        liveFetchCount++;
      }
    }
    console.log(`[internal-links] live-fetch fallback: fetched ${liveFetchCount}/${Math.min(fetchTargets.length, MAX_LIVE_FETCHES)} pages`);
  }

  return { pages, htmlByUrl };
}
