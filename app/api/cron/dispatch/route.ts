import { NextRequest, NextResponse } from "next/server";
import { getSupabase, type SupabaseJob } from "@/lib/supabase";
import { claimJob, runJob } from "@/lib/agent-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

export async function GET(request: NextRequest) {
  // Allow Vercel cron (no auth header) or admin bearer for manual testing
  const auth = request.headers.get("authorization");
  const adminPass = process.env.ADMIN_PASSWORD;
  const isAdmin = adminPass && auth === `Bearer ${adminPass}`;
  // Vercel cron requests originate from Vercel's infrastructure — no extra auth needed
  // If called externally without admin auth, reject
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (!isAdmin && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Claim and run ONE pending Vercel-routed job per dispatch cycle.
  // Running serially with limit=1 guarantees the job completes within the 290s Vercel cap.
  // Jobs with runner='fly' are handled by the Fly.io worker — skip them here.
  const { data: pending } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "pending")
    .eq("runner", "vercel")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  const job = pending[0] as SupabaseJob;

  // Claim atomically — bail if another dispatch already claimed it
  const claimed = await claimJob(job.id);
  if (!claimed) return NextResponse.json({ ok: true, dispatched: 0 });

  // Re-fetch to get the claimed row
  const { data: fresh } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", job.id)
    .single();

  if (!fresh) return NextResponse.json({ ok: true, dispatched: 0 });

  await runJob(fresh as SupabaseJob);

  return NextResponse.json({ ok: true, dispatched: 1 });
}
