import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { runAllRules, type Page, type SiteContext } from "@/lib/audit/rules";

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
          evidence: v.evidence ?? null,
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
        evidence: v.evidence ?? null,
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
