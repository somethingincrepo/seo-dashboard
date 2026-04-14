import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { getContentJobById, getResultForJob } from "@/lib/content";

// GET /api/portal/content-review/article?token=xxx&jobId=yyy
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!token || !jobId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const [job, result] = await Promise.all([
    getContentJobById(jobId),
    getResultForJob(jobId),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job, result });
}
