import { NextRequest, NextResponse } from "next/server";
import { getSupabase, type SupabaseJob } from "@/lib/supabase";
import { claimJob, runJob } from "@/lib/agent-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { job_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — we'll claim any pending job
  }

  const supabase = getSupabase();
  let jobId = body.job_id;

  // If no job_id provided, pick the oldest pending job
  if (!jobId) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!data) {
      return NextResponse.json({ ok: true, message: "No pending jobs" });
    }
    jobId = (data as { id: string }).id;
  }

  // Atomic claim — returns false if the job was already taken
  const claimed = await claimJob(jobId);
  if (!claimed) {
    return NextResponse.json({ ok: true, message: "Job already claimed or not pending" });
  }

  // Fetch full job row
  const { data: jobData, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !jobData) {
    return NextResponse.json({ error: "Job not found after claim" }, { status: 404 });
  }

  const result = await runJob(jobData as SupabaseJob);
  return NextResponse.json({ ok: true, job_id: jobId, ...result });
}
