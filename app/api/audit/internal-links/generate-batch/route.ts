/**
 * POST /api/audit/internal-links/generate-batch
 *
 * Runs the deterministic internal-links pipeline for one client. Used by:
 *   - The worker's weekly `monthlyChangesSchedulerTick` (via the
 *     `audit_internal_links` SOP wrapper) so internal-link Changes land on
 *     the same cadence as the rest of the 4-week delivery breakdown.
 *   - Operator tools / re-runs.
 *
 * Body: { client_id: string, audit_run_id?: string, quota_override?: number }
 * Auth: Bearer ${CRAWLER_SERVICE_TOKEN} (matches the diagnose endpoint).
 *
 * Idempotent: the underlying writer dedupes against existing Internal Link
 * Changes, so calling this multiple times in a row is safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { runInternalLinksGeneration } from "@/lib/audit/internal-links/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return !!auth && auth === `Bearer ${process.env.CRAWLER_SERVICE_TOKEN}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { client_id?: string; audit_run_id?: string; quota_override?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  try {
    const result = await runInternalLinksGeneration({
      clientId: body.client_id,
      auditRunId: body.audit_run_id,
      quotaOverride: typeof body.quota_override === "number" ? body.quota_override : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
