import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { getContentJobsForClient, getContentResultsForClient, type ContentResult } from "@/lib/content";
import { getSupabase } from "@/lib/supabase";
import { contentAirtablePatch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

// GET /api/portal/content-optimization?token=xxx
// Returns all refresh jobs joined with their results
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const companyName = client.fields.company_name || "";

  const [allJobs, allResults] = await Promise.all([
    getContentJobsForClient(companyName).catch(() => []),
    getContentResultsForClient(companyName).catch(() => []),
  ]);

  // Only jobs that are content refreshes
  const refreshJobs = allJobs.filter((j) => !!j.fields.refresh_url);

  // Build jobId → result map (Job ID field returns linked record IDs)
  const resultByJobId = new Map<string, ContentResult>();
  for (const result of allResults) {
    for (const jid of result.fields["Job ID"] ?? []) {
      resultByJobId.set(jid, result);
    }
  }

  const items = refreshJobs.map((job) => ({
    job,
    result: resultByJobId.get(job.id) ?? null,
  }));

  // Sort: ready-for-review first, then in-progress, then completed
  items.sort((a, b) => {
    const rank = (item: typeof a) => {
      const ts = item.job.fields.title_status;
      const approved = item.result?.fields.portal_approval;
      if (ts === "completed" && !approved) return 0;   // ready to review
      if (ts === "approved" && !item.result) return 1;  // SOP running
      return 2;                                          // done
    };
    return rank(a) - rank(b);
  });

  return NextResponse.json({ items });
}

// POST /api/portal/content-optimization?token=xxx
// body: { type: "approve", resultId } — approves refresh + queues publish SOP
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { type: string; resultId?: string };

  if (body.type === "approve" && body.resultId) {
    await contentAirtablePatch("Results", body.resultId, {
      portal_approval: "approved",
      portal_approved_at: new Date().toISOString(),
    });

    // Queue publish_article_wordpress SOP on the Fly.io worker
    try {
      const supabase = getSupabase();
      await supabase.from("jobs").insert({
        sop_name: "publish_article_wordpress",
        runner: "fly",
        client_id: client.id,
        status: "pending",
        payload: { result_id: body.resultId },
      });
    } catch (err) {
      console.error("Failed to queue publish job (non-fatal):", err);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
