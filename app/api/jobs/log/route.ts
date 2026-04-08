import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { JobStatus, LogLevel } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

  let body: {
    job_id?: string;
    message?: string;
    level?: LogLevel;
    status?: JobStatus;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, message, level = "info", status } = body;

  if (!job_id || !message) {
    return NextResponse.json({ error: "job_id and message are required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fire-and-forget: if Supabase is unreachable, log locally and return an error
  // so the VPS can log it, but the agent process should continue regardless.
  const { error: logError } = await supabase
    .from("job_logs")
    .insert({ job_id, message, level });

  if (logError) {
    console.error("Supabase log insert failed:", logError.message);
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  if (status) {
    const update: Record<string, unknown> = { status };
    if (status === "running") {
      update.started_at = new Date().toISOString();
    }
    if (status === "done" || status === "failed") {
      update.finished_at = new Date().toISOString();
    }
    const { error: updateError } = await supabase
      .from("jobs")
      .update(update)
      .eq("id", job_id);

    if (updateError) {
      // Non-fatal: log was written, status update failed
      console.error("Supabase job status update failed:", updateError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
