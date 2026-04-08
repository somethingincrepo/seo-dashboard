import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseJob, JobLog } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const after = Number(request.nextUrl.searchParams.get("after") ?? "0");

  const supabase = getSupabase();

  const [jobResult, logsResult] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).single(),
    supabase
      .from("job_logs")
      .select("*")
      .eq("job_id", id)
      .gt("id", after)
      .order("id", { ascending: true })
      .limit(200),
  ]);

  if (jobResult.error) {
    return NextResponse.json({ error: jobResult.error.message }, { status: 404 });
  }

  return NextResponse.json({
    job: jobResult.data as SupabaseJob,
    logs: (logsResult.data ?? []) as JobLog[],
  });
}
