import { NextRequest, NextResponse } from "next/server";
import { getSession, verifyBearer } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass && verifyBearer(request, adminPass)) return true;
  const session = await getSession();
  return !!session;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Find the most recent completed audit run so we can pass audit_run_id
  // to SOPs that need it (generate_faq_sections, audit_internal_links).
  const { data: auditRows, error: auditErr } = await supabase
    .from("audit_runs")
    .select("id, internal_links_summary, completion_summary")
    .eq("client_id", clientId)
    .eq("status", "complete")
    .order("diagnose_completed_at", { ascending: false })
    .limit(1);

  if (auditErr) {
    return NextResponse.json({ error: `audit_runs lookup failed: ${auditErr.message}` }, { status: 500 });
  }

  const latestRun = auditRows?.[0] ?? null;
  const auditRunId = latestRun?.id ?? null;

  type CompletionSummary = { pages?: number } | null | undefined;

  // Build the first-batch SOP jobs — same set as diagnose route fires.
  const jobs: Array<{ sop_name: string; client_id: string; payload: Record<string, unknown> }> = [
    {
      sop_name: "keyword_research",
      client_id: clientId,
      payload: { client_id: clientId },
    },
    {
      sop_name: "generate_faq_sections",
      client_id: clientId,
      payload: auditRunId
        ? { client_id: clientId, audit_run_id: auditRunId }
        : { client_id: clientId },
    },
    {
      sop_name: "refresh_scheduler",
      client_id: clientId,
      payload: { client_id: clientId, weekly_run: true, force: true },
    },
    {
      sop_name: "page_creation_scheduler",
      client_id: clientId,
      payload: { client_id: clientId, force: true },
    },
    {
      sop_name: "scan_reddit_opportunities",
      client_id: clientId,
      payload: { client_id: clientId },
    },
  ];

  // Conditionally add audit_internal_links LLM fallback:
  // fire it when the deterministic generator found no demand (no R047-R050
  // issues) on a site large enough to have link opportunities.
  if (auditRunId) {
    const ils = latestRun?.internal_links_summary as
      | { status?: string }
      | null
      | undefined;

    // Page count: prefer completion_summary.pages, else count from pages table.
    const summary = latestRun?.completion_summary as CompletionSummary;
    let pageCount: number = typeof summary?.pages === "number" ? summary.pages : 0;
    if (pageCount === 0) {
      const { count } = await supabase
        .from("pages")
        .select("*", { count: "exact", head: true })
        .eq("audit_run_id", auditRunId);
      pageCount = count ?? 0;
    }

    if (ils?.status === "no_demand" && pageCount >= 5) {
      jobs.push({
        sop_name: "audit_internal_links",
        client_id: clientId,
        payload: { client_id: clientId, audit_run_id: auditRunId, mode: "first_batch_llm" },
      });
    }
  }

  // Insert all jobs. Use upsert-like approach: check for existing pending/running
  // jobs for each SOP to avoid duplicating work in progress.
  const { data: existingJobs } = await supabase
    .from("jobs")
    .select("sop_name")
    .eq("client_id", clientId)
    .in("status", ["pending", "claimed", "running"])
    .in("sop_name", jobs.map((j) => j.sop_name));

  const alreadyQueued = new Set((existingJobs ?? []).map((j: { sop_name: string }) => j.sop_name));

  const toInsert = jobs
    .filter((j) => !alreadyQueued.has(j.sop_name))
    .map((j) => ({
      sop_name: j.sop_name,
      client_id: j.client_id,
      payload: j.payload,
      status: "pending",
      runner: "fly",
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      enqueued: 0,
      skipped: jobs.length,
      message: "All deliverable SOPs already have active jobs queued — no duplicates created.",
    });
  }

  const { error: insertErr } = await supabase.from("jobs").insert(toInsert);
  if (insertErr) {
    return NextResponse.json({ error: `Failed to enqueue jobs: ${insertErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    enqueued: toInsert.length,
    skipped: alreadyQueued.size,
    sops_enqueued: toInsert.map((j) => j.sop_name),
    audit_run_id: auditRunId,
  });
}
