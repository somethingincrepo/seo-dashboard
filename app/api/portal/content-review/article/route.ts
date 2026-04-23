import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { getContentJobById, getResultForJobByTitle } from "@/lib/content";

// GET /api/portal/content-review/article?token=xxx&jobId=yyy
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!token || !jobId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const job = await getContentJobById(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // {Job ID} in Airtable formula language returns the primary field (Blog Title) of the
  // linked job record — not the record ID. So we filter by blog title.
  const result = await getResultForJobByTitle(job.fields["Blog Title"]);

  return NextResponse.json({ job, result });
}
