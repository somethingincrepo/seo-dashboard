import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { getLatestAuditRun } from "@/lib/audit/queries";

export const dynamic = "force-dynamic";

// GET /api/portal/audit-status?token=xxx
// Lightweight status check for in-progress audit polling.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const run = await getLatestAuditRun(client.id);
  if (!run) return NextResponse.json({ status: "never_run", pages_crawled: 0 });

  return NextResponse.json({
    status: run.status,
    pages_crawled: run.pages_crawled ?? 0,
  });
}
