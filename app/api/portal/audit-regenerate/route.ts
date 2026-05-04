import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";
import { RULE_TO_FIX_TYPE, FIX_TYPE_TO_SOP, chunk, ISSUES_PER_JOB } from "@/lib/audit/generation";

export const dynamic = "force-dynamic";

// POST /api/portal/audit-regenerate?token=xxx
// body: { issue_ids: string[] }
// Resets fix_status for the given issues and enqueues fresh generation jobs.
// Used when an issue's previous generation failed or the user wants a different take.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: { issue_ids?: string[] };
  try {
    body = (await request.json()) as { issue_ids?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = (body.issue_ids ?? []).filter((s) => typeof s === "string" && s.length > 0);
  if (ids.length === 0) return NextResponse.json({ error: "issue_ids required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Too many issue_ids" }, { status: 400 });

  const supabase = getSupabase();

  // Pull the issues so we can verify ownership + resolve fix-type per rule.
  const { data: rows, error: fetchErr } = await supabase
    .from("issues")
    .select("id, rule_id, audit_run_id, fix_attempts")
    .eq("client_id", client.id)
    .in("id", ids);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  const owned = (rows ?? []) as Array<{ id: string; rule_id: string; audit_run_id: string; fix_attempts: number | null }>;
  if (owned.length === 0) return NextResponse.json({ error: "No matching issues" }, { status: 404 });

  // Group by rule → fix-type → SOP
  const byFixType = new Map<string, Array<{ id: string; audit_run_id: string }>>();
  for (const r of owned) {
    const ft = RULE_TO_FIX_TYPE[r.rule_id];
    if (!ft) continue; // Mechanical rule; nothing to regenerate via SOP
    const sop = FIX_TYPE_TO_SOP[ft];
    if (!byFixType.has(sop)) byFixType.set(sop, []);
    byFixType.get(sop)!.push({ id: r.id, audit_run_id: r.audit_run_id });
  }
  if (byFixType.size === 0) {
    return NextResponse.json({ error: "Selected issues have no agent fix-type" }, { status: 400 });
  }

  // Reset fix_status on all targeted issues, bump fix_attempts.
  await supabase
    .from("issues")
    .update({ fix_status: "queued", fix_error: null })
    .in("id", ids);
  // bump attempt counter (separate query — Supabase can't atomically increment via update())
  for (const r of owned) {
    await supabase
      .from("issues")
      .update({ fix_attempts: (r.fix_attempts ?? 0) + 1 })
      .eq("id", r.id);
  }

  let jobsCreated = 0;
  for (const [sopName, list] of byFixType) {
    // All issues in a regen request belong to the same client, but may span audit_runs.
    // Group by audit_run_id so each job's payload is well-formed.
    const byRun = new Map<string, string[]>();
    for (const item of list) {
      if (!byRun.has(item.audit_run_id)) byRun.set(item.audit_run_id, []);
      byRun.get(item.audit_run_id)!.push(item.id);
    }
    for (const [runId, runIds] of byRun) {
      for (const c of chunk(runIds, ISSUES_PER_JOB)) {
        const { error: jobErr } = await supabase.from("jobs").insert({
          sop_name: sopName,
          client_id: client.id,
          payload: { issue_ids: c, audit_run_id: runId },
          status: "pending",
          runner: "fly",
        });
        if (jobErr) {
          console.error(`[regenerate] enqueue ${sopName} failed:`, jobErr.message);
          continue;
        }
        jobsCreated += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, jobs_enqueued: jobsCreated });
}
