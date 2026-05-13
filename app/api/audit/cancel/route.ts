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

/** POST /api/audit/cancel  { audit_run_id: string }
 *  Force-marks an in-flight audit run as failed so a new one can be started immediately.
 *  Admin-only. Safe to call on already-failed/completed runs — it's a no-op in that case. */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { audit_run_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { audit_run_id } = body;
  if (!audit_run_id) {
    return NextResponse.json({ error: "audit_run_id is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: run } = await supabase
    .from("audit_runs")
    .select("id, status, client_name")
    .eq("id", audit_run_id)
    .single();

  if (!run) {
    return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
  }

  if (!["queued", "crawling", "crawled", "diagnosing"].includes(run.status)) {
    return NextResponse.json({ ok: true, message: `Run already in terminal state: ${run.status}` });
  }

  const { error } = await supabase
    .from("audit_runs")
    .update({
      status: "failed",
      error_message: "Manually cancelled via admin API.",
    })
    .eq("id", audit_run_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cancelled: audit_run_id, client_name: run.client_name });
}
