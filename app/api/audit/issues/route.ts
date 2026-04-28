import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getIssuesForRun } from "@/lib/audit/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const runId = new URL(request.url).searchParams.get("run");
  if (!runId) return NextResponse.json({ error: "run param required" }, { status: 400 });
  const issues = await getIssuesForRun(runId);
  return NextResponse.json({ issues });
}
