import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";
import { RULE_TO_FIX_TYPE, FIX_TYPE_TO_SOP, groupByFixType, chunk, ISSUES_PER_JOB } from "@/lib/audit/generation";

export const dynamic = "force-dynamic";

// POST /api/portal/audit-decide?token=xxx
// body: { issue_ids: string[], decision: "approved" | "dismissed" | null }
// Marks 1..N issues with the given decision. When decision="approved", also
// enqueues the appropriate generate_fix_* job for each fixable issue.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: { issue_ids?: string[]; decision?: "approved" | "dismissed" | "resolved" | null };
  try {
    body = (await request.json()) as { issue_ids?: string[]; decision?: "approved" | "dismissed" | "resolved" | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = (body.issue_ids ?? []).filter((s) => typeof s === "string" && s.length > 0);
  const d = body.decision;
  const decision = d === "approved" || d === "dismissed" || d === "resolved" ? d : null;

  if (ids.length === 0) {
    return NextResponse.json({ error: "issue_ids required" }, { status: 400 });
  }
  if (ids.length > 5000) {
    return NextResponse.json({ error: "Too many issue_ids in one request" }, { status: 400 });
  }

  const supabase = getSupabase();
  const recordId = client.id;
  const now = new Date().toISOString();
  const decidedBy = client.fields.contact_email ?? client.fields.client_id ?? "portal";

  const update = decision === null
    ? { decision: null, decided_at: null, decided_by: null }
    : { decision, decided_at: now, decided_by: decidedBy };

  const { error, count } = await supabase
    .from("issues")
    .update(update, { count: "exact" })
    .eq("client_id", recordId)
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // On approval, enqueue fix generation jobs for fixable issues.
  // Skip if un-deciding (decision=null) or dismissing.
  let jobsEnqueued = 0;
  if (decision === "approved") {
    // Fetch the issue details needed to route each issue to the right SOP.
    const { data: rows, error: fetchErr } = await supabase
      .from("issues")
      .select("id, rule_id, audit_run_id, fix_status")
      .eq("client_id", recordId)
      .in("id", ids);

    if (!fetchErr && rows && rows.length > 0) {
      const typed = rows as Array<{ id: string; rule_id: string; audit_run_id: string; fix_status: string | null }>;

      // Only enqueue for issues that don't already have a fix in flight.
      const needFix = typed.filter(
        (r) => RULE_TO_FIX_TYPE[r.rule_id] && r.fix_status !== "queued" && r.fix_status !== "generating" && r.fix_status !== "generated",
      );

      if (needFix.length > 0) {
        // Group by fix-type, then by audit_run_id (an approval batch may span runs).
        const byFixType = groupByFixType(needFix);
        for (const [fixType, list] of byFixType) {
          const sopName = FIX_TYPE_TO_SOP[fixType];
          // Sub-group by audit_run_id so each job's payload is well-formed.
          const byRun = new Map<string, typeof list>();
          for (const item of list) {
            if (!byRun.has(item.audit_run_id)) byRun.set(item.audit_run_id, []);
            byRun.get(item.audit_run_id)!.push(item);
          }
          for (const [runId, runItems] of byRun) {
            for (const c of chunk(runItems, ISSUES_PER_JOB)) {
              const issueIds = c.map((i) => i.id);
              const { error: jobErr } = await supabase.from("jobs").insert({
                sop_name: sopName,
                client_id: recordId,
                payload: { issue_ids: issueIds, audit_run_id: runId },
                status: "pending",
                runner: "fly",
              });
              if (jobErr) {
                console.error(`[audit-decide] failed to enqueue ${sopName}:`, jobErr.message);
                continue;
              }
              await supabase
                .from("issues")
                .update({ fix_status: "queued" })
                .in("id", issueIds);
              jobsEnqueued += 1;
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, updated: count ?? ids.length, decision, jobs_enqueued: jobsEnqueued });
}
