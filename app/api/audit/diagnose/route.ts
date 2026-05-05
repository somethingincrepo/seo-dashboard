import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { runAllRules, type Page, type SiteContext } from "@/lib/audit/rules";
import { buildFixGuidance } from "@/lib/audit/rules/fix-guidance";
import { getRuleDescription } from "@/lib/audit/rules/rule-descriptions";
import { generateMechanicalFix, MECHANICAL_RULE_IDS } from "@/lib/audit/mechanical-fixes";
import { RULE_TO_FIX_TYPE, FIX_TYPE_TO_SOP, groupByFixType, chunk, ISSUES_PER_JOB } from "@/lib/audit/generation";
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
      status: "complete" | "skipped" | "no_demand" | "errored";
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

    // Path B — enqueue agent jobs for the per-fix-type rules
    // Internal-link rules are excluded — they were handled synchronously in
    // Path C above by the deterministic TS generator.
    const agentIssues = allIssues.filter(
      (i) =>
        i.scope === "page" &&
        RULE_TO_FIX_TYPE[i.rule_id] &&
        !INTERNAL_LINK_RULES.has(i.rule_id),
    );
    const grouped = groupByFixType(agentIssues);
    let jobsCreated = 0;
    for (const [fixType, list] of grouped) {
      const sopName = FIX_TYPE_TO_SOP[fixType];
      const chunks = chunk(list, ISSUES_PER_JOB);
      for (const c of chunks) {
        const ids = c.map((i) => i.id);
        const { error: jobErr } = await supabase.from("jobs").insert({
          sop_name: sopName,
          client_id: run.client_id,
          payload: { issue_ids: ids, audit_run_id: auditRunId },
          status: "pending",
          runner: "fly",
        });
        if (jobErr) {
          console.error(`[diagnose] failed to enqueue ${sopName} job:`, jobErr.message);
          continue;
        }
        // Mark these issues as queued
        await supabase
          .from("issues")
          .update({ fix_status: "queued" })
          .in("id", ids);
        jobsCreated += 1;
      }
    }

    // ── Mark the audit complete BEFORE enqueueing downstream SOPs ────────
    // The schedulers (refresh_scheduler, keyword_research) read the most
    // recent audit_run with status="complete" to find pages. If we enqueue
    // them while the row is still "diagnosing", a fast worker can claim and
    // run the SOP before the status flip lands and skip the client because
    // "no completed audit run exists." Flipping status first eliminates that
    // race entirely.
    const completionSummary = {
      pages: pages.length,
      issues: issueRows.length,
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
      issues_found: issueRows.length,
      internal_links_summary: internalLinksSummary,
      completion_summary: completionSummary,
    };
    let updateErr = (await supabase.from("audit_runs").update(updatePayload).eq("id", auditRunId)).error;
    if (updateErr) {
      console.warn(`[diagnose] audit_runs update with summary columns failed (${updateErr.message}); retrying without`);
      const fallbackPayload = {
        status: "complete",
        diagnose_completed_at: completedAt,
        issues_found: issueRows.length,
      };
      updateErr = (await supabase.from("audit_runs").update(fallbackPayload).eq("id", auditRunId)).error;
      if (updateErr) {
        throw new Error(`audit_runs status flip failed: ${updateErr.message}`);
      }
    }

    // ── First-batch deliverables ─────────────────────────────────────────
    // Kick off the package's first-week deliverables so clients see content
    // titles, internal-link suggestions, refresh picks, and keyword groups
    // queued up immediately after the audit lands.
    //
    // Internal-link first batch is produced synchronously above (Path C), so
    // `audit_internal_links` is intentionally NOT enqueued — it would race
    // with the deterministic TS generator and overwrite the proposals with
    // LLM-rewritten copy.
    //
    // We enqueue keyword_research AND refresh_scheduler directly (with
    // single-client + force=true). keyword_research's fan_out also produces
    // refresh_scheduler under normal flow, but the chain is fragile: if the
    // SOP fails for any reason (OpenRouter blip, DataForSEO quota, prompt
    // drift) the refreshes never get scheduled. Enqueueing refresh_scheduler
    // directly here makes it independent of keyword_research succeeding.
    // Both SOPs are idempotent in single-client mode so duplicate work is
    // a no-op.
    const firstBatchSops = [
      { sop_name: "keyword_research", payload: { client_id: run.client_id } },
      { sop_name: "refresh_scheduler", payload: { client_id: run.client_id, weekly_run: true, force: true } },
    ];
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
      agent_jobs_enqueued: jobsCreated,
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
