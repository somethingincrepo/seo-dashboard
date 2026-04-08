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

  // Find up to 5 pending Vercel-routed jobs, oldest first.
  // Jobs with runner='fly' are handled by the Fly.io worker — skip them here.
  const { data: pending } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "pending")
    .eq("runner", "vercel")
    .order("created_at", { ascending: true })
    .limit(5);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  let dispatched = 0;

  for (const job of pending as SupabaseJob[]) {
    // Claim atomically — skip if another dispatch already claimed it
    const claimed = await claimJob(job.id);
    if (!claimed) continue;

    // Re-fetch to get the claimed row
    const { data: fresh } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job.id)
      .single();

    if (!fresh) continue;

    await runJob(fresh as SupabaseJob);
    dispatched++;
  }

  return NextResponse.json({ ok: true, dispatched });
}
