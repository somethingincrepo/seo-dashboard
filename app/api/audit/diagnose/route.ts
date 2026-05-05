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
    if (internalLinkIssues.length > 0) {
      try {
        const linksResult = await runInternalLinksGeneration({
          clientId: run.client_id,
          auditRunId,
        });
        internalLinkProposalsWritten = linksResult.proposals_generated;
        internalLinkFailures = linksResult.proposal_failures;
        internalLinkChangesWritten = linksResult.changes_written;
      } catch (e) {
        console.error("[diagnose] internal-links pipeline threw:", e instanceof Error ? e.message : String(e));
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

    // ── First-batch deliverables ─────────────────────────────────────────
    // Kick off the package's first-week deliverables so clients see content
    // titles, internal-link suggestions, refresh picks, and keyword groups
    // queued up immediately after the audit lands. Subsequent weeks fire on
    // the worker's scheduler ticks.
    // First-batch SOPs. The internal-links first batch is now produced
    // synchronously by the deterministic TS generator above (Path C), so
    // `audit_internal_links` is intentionally NOT enqueued here — keeping
    // it would race with the TS generator and produce LLM-rewritten copy
    // that conflicts with the deterministic proposals.
    // Single first-batch entry point. keyword_research is the orchestrator
    // of the title + refresh pipelines: when it finishes writing
    // keyword_groups it fans out content_scheduler + refresh_scheduler with
    // force=true. Enqueueing them here too caused the original Promptive
    // gap — the schedulers ran in parallel with kw research, saw empty
    // keyword_groups, and skipped the client; title_generation never fired.
    const firstBatchSops = [
      { sop_name: "keyword_research", payload: { client_id: run.client_id } },
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
      }
    }

    await supabase
      .from("audit_runs")
      .update({
        status: "complete",
        diagnose_completed_at: new Date().toISOString(),
        issues_found: issueRows.length,
      })
      .eq("id", auditRunId);

    return NextResponse.json({
      ok: true,
      pages: pages.length,
      issues: issueRows.length,
      mechanical_fixes: mechanicalUpdates.length,
      internal_link_proposals: internalLinkProposalsWritten,
      internal_link_changes_written: internalLinkChangesWritten,
      internal_link_failures: internalLinkFailures,
      agent_jobs_enqueued: jobsCreated,
      first_batch_jobs_enqueued: firstBatchSops.length,
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
