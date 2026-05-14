import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { airtableFetch, airtablePatch } from "@/lib/airtable";
import { runAllRules, type Page, type SiteContext } from "@/lib/audit/rules";
import { buildFixGuidance } from "@/lib/audit/rules/fix-guidance";
import { getRuleDescription } from "@/lib/audit/rules/rule-descriptions";
import { generateMechanicalFix, MECHANICAL_RULE_IDS } from "@/lib/audit/mechanical-fixes";
import { runInternalLinksGeneration } from "@/lib/audit/internal-links/run";

const INTERNAL_LINK_RULES = new Set(["R047", "R048", "R049", "R050"]);

export const dynamic = "force-dynamic";
export const maxDuration = 300; // up to 5 minutes for very large sites

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return !!auth && auth === `Bearer ${process.env.CRAWLER_SERVICE_TOKEN}`;
}

interface AuditRunRow {
  id: string;
  client_id: string;
  client_name: string;
  root_url: string;
  status: string;
  robots_txt_present: boolean | null;
  robots_txt_content: string | null;
  sitemap_present: boolean | null;
  sitemap_urls: string[] | null;
  llms_txt_present: boolean | null;
  llms_full_txt_present: boolean | null;
  https_enforced: boolean | null;
  hsts_header_present: boolean | null;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { audit_run_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auditRunId = body.audit_run_id;
  if (!auditRunId) {
    return NextResponse.json({ error: "audit_run_id is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: runData, error: runErr } = await supabase
    .from("audit_runs")
    .select("*")
    .eq("id", auditRunId)
    .single();
  if (runErr || !runData) {
    return NextResponse.json({ error: `audit_run not found: ${runErr?.message ?? ""}` }, { status: 404 });
  }
  const run = runData as AuditRunRow;
  if (run.status !== "crawled") {
    return NextResponse.json(
      { error: `audit_run is in status '${run.status}', expected 'crawled'` },
      { status: 409 },
    );
  }

  await supabase
    .from("audit_runs")
    .update({ status: "diagnosing", diagnose_started_at: new Date().toISOString() })
    .eq("id", auditRunId);

  try {
    const pages = await loadAllPages(supabase, auditRunId);

    const site: SiteContext = {
      root_url: run.root_url,
      robots_txt_present: run.robots_txt_present,
      robots_txt_content: run.robots_txt_content,
      sitemap_present: run.sitemap_present,
      sitemap_urls: run.sitemap_urls,
      llms_txt_present: run.llms_txt_present,
      llms_full_txt_present: run.llms_full_txt_present,
      https_enforced: run.https_enforced,
      hsts_header_present: run.hsts_header_present,
    };

    const { page_violations, site_violations } = runAllRules({ pages, site });

    const issueRows: Record<string, unknown>[] = [];
    for (const p of pages) {
      const vs = page_violations.get(p.id) ?? [];
      for (const v of vs) {
        issueRows.push({
          audit_run_id: auditRunId,
          client_id: run.client_id,
          page_id: p.id,
          page_url: p.url,
          scope: "page",
          rule_id: v.rule_id,
          rule_name: v.rule_name,
          severity: v.severity,
          category: v.category,
          current_value: v.current_value,
          expected_value: v.expected_value,
          evidence: {
            ...(v.evidence ?? {}),
            fix_guidance: buildFixGuidance(v.rule_id, {
              page_url: p.url,
              current_value: v.current_value,
              evidence: (v.evidence ?? null) as Record<string, unknown> | null,
            }),
            rule_description: getRuleDescription(v.rule_id),
          },
          proposed_value: null,
        });
      }
    }
    for (const v of site_violations) {
      issueRows.push({
        audit_run_id: auditRunId,
        client_id: run.client_id,
        page_id: null,
        page_url: null,
        scope: "site",
        rule_id: v.rule_id,
        rule_name: v.rule_name,
        severity: v.severity,
        category: v.category,
        current_value: v.current_value,
        expected_value: v.expected_value,
        evidence: {
          ...(v.evidence ?? {}),
          fix_guidance: buildFixGuidance(v.rule_id, {
            page_url: null,
            current_value: v.current_value,
            evidence: (v.evidence ?? null) as Record<string, unknown> | null,
          }),
          rule_description: getRuleDescription(v.rule_id),
        },
        proposed_value: null,
      });
    }

    if (issueRows.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < issueRows.length; i += CHUNK) {
        const slice = issueRows.slice(i, i + CHUNK);
        const { error: insErr } = await supabase.from("issues").insert(slice);
        if (insErr) throw new Error(`issues insert failed: ${insErr.message}`);
      }
    }

    // ── Fix generation: mechanical (synchronous) + agent (enqueued) ──────
    // Re-fetch the just-inserted issues so we have the database-assigned ids.
    const { data: insertedIssues, error: refetchErr } = await supabase
      .from("issues")
      .select("id, rule_id, page_id, page_url, current_value, evidence, scope")
      .eq("audit_run_id", auditRunId);
    if (refetchErr) throw new Error(`issues refetch failed: ${refetchErr.message}`);
    const allIssues = (insertedIssues ?? []) as Array<{
      id: string;
      rule_id: string;
      page_id: string | null;
      page_url: string | null;
      current_value: string | null;
      evidence: Record<string, unknown> | null;
      scope: "page" | "site";
    }>;

    // Page lookup (keyed by id) so mechanical generators can read crawled data.
    const pagesById = new Map<string, Page>();
    for (const p of pages) pagesById.set(p.id, p);

    // Path A — synchronous mechanical fixes
    const mechanicalUpdates: Array<{ id: string; proposed_value: string }> = [];
    for (const i of allIssues) {
      if (!MECHANICAL_RULE_IDS.has(i.rule_id)) continue;
      const page = i.page_id ? pagesById.get(i.page_id) ?? null : null;
      const proposed = generateMechanicalFix(
        { rule_id: i.rule_id, page_url: i.page_url, current_value: i.current_value, evidence: i.evidence },
        page,
        { rootUrl: run.root_url, sitemapUrls: run.sitemap_urls ?? [], pages },
      );
      if (proposed) mechanicalUpdates.push({ id: i.id, proposed_value: proposed });
    }
    // Bulk-update by id. Each row is a tiny payload so we send them in chunks.
    if (mechanicalUpdates.length > 0) {
      const nowIso = new Date().toISOString();
      const CHUNK = 50;
      for (let i = 0; i < mechanicalUpdates.length; i += CHUNK) {
        const slice = mechanicalUpdates.slice(i, i + CHUNK);
        // Supabase doesn't have a true bulk-update-by-id-with-different-values; loop per row.
        await Promise.all(
          slice.map((u) =>
            supabase
              .from("issues")
              .update({ proposed_value: u.proposed_value, fix_status: "generated", fix_generated_at: nowIso })
              .eq("id", u.id),
          ),
        );
      }
    }

    // Path C — synchronous deterministic internal-link proposals (R047–R050)
    // Replaces the LLM SOP `generate_fix_internal_links` for these rules with
    // a pure-TS generator that fetches each candidate source page, scans for
    // exact-match anchor candidates derived from target page metadata, and
    // ranks with stable tiebreaks. The output JSON includes the live
    // paragraph text + HTML so the portal can show the user the actual
    // on-page content where the link will be inserted.
    const internalLinkIssues = allIssues.filter(
      (i) => i.scope === "page" && INTERNAL_LINK_RULES.has(i.rule_id),
    );
    let internalLinkProposalsWritten = 0;
    let internalLinkFailures = 0;
    let internalLinkChangesWritten = 0;
    let internalLinksSummary: {
      pages_considered: number;
      issues_seen: number;
      proposals_generated: number;
      proposal_failures: number;
      changes_written: number;
      status: "complete" | "skipped" | "no_demand" | "errored" | "no_html" | "no_match";
      message: string;
    } = {
      pages_considered: pages.length,
      issues_seen: 0,
      proposals_generated: 0,
      proposal_failures: 0,
      changes_written: 0,
      status: "no_demand",
      message: "no R047–R050 issues raised by the rules engine; no internal-link proposals needed",
    };
    if (internalLinkIssues.length > 0) {
      try {
        const linksResult = await runInternalLinksGeneration({
          clientId: run.client_id,
          auditRunId,
        });
        internalLinkProposalsWritten = linksResult.proposals_generated;
        internalLinkFailures = linksResult.proposal_failures;
        internalLinkChangesWritten = linksResult.changes_written;
        internalLinksSummary = {
          pages_considered: linksResult.pages_considered,
          issues_seen: linksResult.issues_seen,
          proposals_generated: linksResult.proposals_generated,
          proposal_failures: linksResult.proposal_failures,
          changes_written: linksResult.changes_written,
          status: linksResult.status,
          message: linksResult.message ?? "",
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[diagnose] internal-links pipeline threw:", msg);
        internalLinksSummary = {
          pages_considered: pages.length,
          issues_seen: internalLinkIssues.length,
          proposals_generated: 0,
          proposal_failures: 0,
          changes_written: 0,
          status: "errored",
          message: `internal-links pipeline threw: ${msg.slice(0, 500)}`,
        };
      }
    }

    // Path B — fix generation is deferred until the client approves each issue.
    // Jobs are created by POST /api/portal/audit-decide when decision="approved".
    // This prevents spending money on fixes the client may never want.

    // ── Mark the audit complete BEFORE enqueueing downstream SOPs ────────
    // The schedulers (refresh_scheduler, keyword_research) read the most
    // recent audit_run with status="complete" to find pages. If we enqueue
    // them while the row is still "diagnosing", a fast worker can claim and
    // run the SOP before the status flip lands and skip the client because
    // "no completed audit run exists." Flipping status first eliminates that
    // race entirely.
    // Count distinct rule_ids — one issue = one rule type, regardless of how many pages it fires on.
    const distinctIssueCount = new Set(issueRows.map((r) => r.rule_id as string)).size;

    const completionSummary = {
      pages: pages.length,
      issues: distinctIssueCount,
      mechanical_fixes: mechanicalUpdates.length,
      internal_links: internalLinksSummary,
      jobs_enqueued: {} as Record<string, "pending" | "failed">,
    };

    // Try the new shape first (with summary columns). Fall back to the
    // legacy shape if the migration hasn't been applied yet — the new
    // columns are observability-only, never load-bearing.
    const completedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "complete",
      diagnose_completed_at: completedAt,
      issues_found: distinctIssueCount,
      internal_links_summary: internalLinksSummary,
      completion_summary: completionSummary,
    };
    let updateErr = (await supabase.from("audit_runs").update(updatePayload).eq("id", auditRunId)).error;
    if (updateErr) {
      console.warn(`[diagnose] audit_runs update with summary columns failed (${updateErr.message}); retrying without`);
      const fallbackPayload = {
        status: "complete",
        diagnose_completed_at: completedAt,
        issues_found: distinctIssueCount,
      };
      updateErr = (await supabase.from("audit_runs").update(fallbackPayload).eq("id", auditRunId)).error;
      if (updateErr) {
        throw new Error(`audit_runs status flip failed: ${updateErr.message}`);
      }
    }

    // ── Advance plan_status to "active" ──────────────────────────────────
    // The old agentic audit_parent SOP did this in Phase 4. The deterministic
    // pipeline has no equivalent — without this, clients stay at "month1_audit"
    // forever: the monthly audit scheduler, monthAdvanceTick, and reportScheduler
    // all filter for plan_status="active" and silently skip them.
    // Only advance from month1_audit → active (not month1_audit_complete or any
    // other status we don't own).
    try {
      type ClientRow = { id: string; fields: { plan_status?: string } };
      const clientRows = await airtableFetch<ClientRow>("Clients", {
        filterByFormula: `RECORD_ID() = "${run.client_id}"`,
        fields: ["plan_status"],
        maxRecords: 1,
      });
      const currentStatus = clientRows[0]?.fields?.plan_status;
      if (currentStatus === "month1_audit" || currentStatus === "month1_audit_complete") {
        await airtablePatch("Clients", run.client_id, { plan_status: "active" });
        console.log(`[diagnose] advanced plan_status from ${currentStatus} → active for ${run.client_id}`);
      }
    } catch (e) {
      // Non-fatal: deliverables and audit data are still valid even if this patch fails.
      // The monthly audit and report schedulers will silently skip this client until
      // the status is corrected manually or on the next successful audit.
      console.error(`[diagnose] plan_status advancement failed for ${run.client_id} (non-fatal):`, e instanceof Error ? e.message : e);
    }

    // ── First-batch deliverables ─────────────────────────────────────────
    // Kick off the package's first-week deliverables so clients see content
    // titles, internal-link suggestions, refresh picks, and keyword groups
    // queued up immediately after the audit lands.
    //
    // Internal-link first batch normally comes from the deterministic TS
    // generator (Path C above). When the rules engine raised zero R047-R050
    // issues — common for small sites — Path C produces nothing and the
    // /internal-links portal page is empty for the customer's entire month-1
    // window. To avoid that, fall back to the LLM-driven `audit_internal_links`
    // SOP in `first_batch_llm` mode, which surfaces 3-5 proposals with
    // relaxed thresholds. Only fires when the deterministic generator
    // produced no_demand AND the site has at least 5 pages (below that we
    // genuinely don't have enough surface area to link).
    //
    // We enqueue keyword_research AND refresh_scheduler directly (with
    // single-client + force=true). keyword_research's fan_out also produces
    // refresh_scheduler under normal flow, but the chain is fragile: if the
    // SOP fails for any reason (OpenRouter blip, DataForSEO quota, prompt
    // drift) the refreshes never get scheduled. Enqueueing refresh_scheduler
    // directly here makes it independent of keyword_research succeeding.
    // All SOPs are idempotent in single-client mode so duplicate work is
    // a no-op.
    const firstBatchSops: Array<{ sop_name: string; payload: Record<string, unknown> }> = [
      { sop_name: "keyword_research", payload: { client_id: run.client_id } },
      { sop_name: "refresh_scheduler", payload: { client_id: run.client_id, weekly_run: true, force: true } },
      // page_creation_scheduler is intentionally included here AND in keyword_research Step 8 fan_out.
      // The early run (this one) produces 0 suggestions because keyword_groups don't exist yet.
      // The keyword_research fan_out fires a second run after keyword_groups are written — that one
      // produces the actual suggestions. Monthly cap prevents any over-generation.
      { sop_name: "page_creation_scheduler", payload: { client_id: run.client_id, force: true } },
      { sop_name: "generate_faq_sections", payload: { client_id: run.client_id, audit_run_id: auditRunId } },
      // Reddit scan: fires immediately using raw intake keywords as fallback.
      // The endpoint reads keyword_groups from Airtable if available; falls back to the
      // raw keywords field. A second scan fires weekly via the GET cron endpoint once
      // keyword_groups are populated by keyword_research.
      { sop_name: "scan_reddit_opportunities", payload: { client_id: run.client_id } },
    ];
    if ((internalLinksSummary.status === "no_demand" || internalLinksSummary.changes_written === 0) && pages.length >= 5) {
      firstBatchSops.push({
        sop_name: "audit_internal_links",
        payload: {
          client_id: run.client_id,
          audit_run_id: auditRunId,
          mode: "first_batch_llm",
        },
      });
    }
    for (const job of firstBatchSops) {
      const { error: deliverableErr } = await supabase.from("jobs").insert({
        sop_name: job.sop_name,
        client_id: run.client_id,
        payload: job.payload,
        status: "pending",
        runner: "fly",
      });
      if (deliverableErr) {
        console.error(`[diagnose] failed to enqueue ${job.sop_name}:`, deliverableErr.message);
        completionSummary.jobs_enqueued[job.sop_name] = "failed";
      } else {
        completionSummary.jobs_enqueued[job.sop_name] = "pending";
      }
    }

    // Patch the completion_summary again now that we know the enqueue
    // results. Best-effort — if the column doesn't exist, swallow.
    await supabase
      .from("audit_runs")
      .update({ completion_summary: completionSummary })
      .eq("id", auditRunId)
      .then(({ error }) => {
        if (error) console.warn(`[diagnose] completion_summary update failed (${error.message}); column may be missing`);
      });

    return NextResponse.json({
      ok: true,
      pages: pages.length,
      issues: issueRows.length,
      mechanical_fixes: mechanicalUpdates.length,
      internal_link_proposals: internalLinkProposalsWritten,
      internal_link_changes_written: internalLinkChangesWritten,
      internal_link_failures: internalLinkFailures,
      internal_links_summary: internalLinksSummary,
      agent_jobs_enqueued: 0,
      first_batch_jobs_enqueued: firstBatchSops.length,
      first_batch_results: completionSummary.jobs_enqueued,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("audit_runs").update({ status: "failed", error_message: msg }).eq("id", auditRunId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function loadAllPages(
  supabase: ReturnType<typeof getSupabase>,
  auditRunId: string,
): Promise<Page[]> {
  const PAGE_SIZE = 1000;
  const all: Page[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("audit_run_id", auditRunId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`pages load failed: ${error.message}`);
    const rows = (data ?? []) as Page[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
