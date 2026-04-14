import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { getContentJobById, getContentResultsForClient } from "@/lib/content";

// GET /api/portal/content-review/article?token=xxx&jobId=yyy
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!token || !jobId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const companyName = client.fields.company_name || "";

  const [job, allResults] = await Promise.all([
    getContentJobById(jobId),
    getContentResultsForClient(companyName),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Filter JS-side — Airtable formula ARRAYJOIN on a linked record field returns
  // primary field display values, not record IDs, so formula-based FIND doesn't match.
  const result = allResults.find((r) => r.fields["Job ID"]?.includes(jobId)) ?? null;

  return NextResponse.json({ job, result });
}
