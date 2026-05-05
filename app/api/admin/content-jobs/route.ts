import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { contentAirtableFetch, contentAirtablePatch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

const CONTENT_JOBS_TABLE = "Content Jobs";

interface ContentJobsRow {
  id: string;
  fields: {
    "Blog Title"?: string;
    "Client ID"?: string[];
    "Client Name (from Client ID)"?: string[];
    "Search intent"?: string;
    "Content type"?: string;
    "Desired length range"?: string;
    Status?: string;
    title_status?: string;
    approved_at?: string;
    webhook_retry_count?: number;
    webhook_last_retry_at?: string;
    webhook_error?: string;
  };
}

// ---------------------------------------------------------------------------
// GET — list Content Jobs grouped by status, plus a stuck/failed table
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Last 7 days. Airtable's TODAY() / DATEADD work in formulas.
  const filter = `IS_AFTER({approved_at}, DATEADD(NOW(), -7, 'days'))`;
  const records = await contentAirtableFetch<ContentJobsRow>(CONTENT_JOBS_TABLE, {
    filterByFormula: filter,
    maxRecords: 200,
  });

  // Bucket by Status
  const counts: Record<string, number> = {
    Queued: 0,
    "In Progress": 0,
    Completed: 0,
    "Webhook Failed": 0,
    Other: 0,
  };
  const stuckOrFailed: Array<{
    id: string;
    blogTitle: string;
    clientName: string;
    status: string;
    approvedAt: string | null;
    retryCount: number;
    lastRetryAt: string | null;
    error: string | null;
  }> = [];

  const nowMs = Date.now();
  const STALL_MS = 30 * 60_000;

  for (const r of records) {
    const status = r.fields.Status ?? "Other";
    counts[status] = (counts[status] ?? 0) + 1;

    const approvedAt = r.fields.approved_at ?? null;
    const isStuck =
      status === "Queued" &&
      approvedAt != null &&
      nowMs - new Date(approvedAt).getTime() > STALL_MS;
    const isFailed = status === "Webhook Failed";

    if (isStuck || isFailed) {
      stuckOrFailed.push({
        id: r.id,
        blogTitle: r.fields["Blog Title"] ?? "(untitled)",
        clientName: r.fields["Client Name (from Client ID)"]?.[0] ?? "(unknown)",
        status,
        approvedAt,
        retryCount: r.fields.webhook_retry_count ?? 0,
        lastRetryAt: r.fields.webhook_last_retry_at ?? null,
        error: r.fields.webhook_error ?? null,
      });
    }
  }

  // Sort stuck/failed: failed first, then stuck oldest first.
  stuckOrFailed.sort((a, b) => {
    if (a.status !== b.status) return a.status === "Webhook Failed" ? -1 : 1;
    return (a.approvedAt ?? "").localeCompare(b.approvedAt ?? "");
  });

  return NextResponse.json({ counts, stuckOrFailed });
}

// ---------------------------------------------------------------------------
// POST — manual retry of a single Content Job's n8n webhook
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { record_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { record_id } = body;
  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "N8N_CONTENT_WEBHOOK_URL is not configured" }, { status: 500 });
  }

  // Re-fetch the row to build the same payload shape the portal sends.
  const records = await contentAirtableFetch<ContentJobsRow>(CONTENT_JOBS_TABLE, {
    filterByFormula: `RECORD_ID()="${record_id}"`,
    maxRecords: 1,
  });
  const row = records[0];
  if (!row) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const blogTitle = row.fields["Blog Title"] ?? "";
  const clientIds = (row.fields["Client ID"] ?? []).map((id) => ({ id }));
  const searchIntent = row.fields["Search intent"] ?? "informational";
  const contentType = typeof row.fields["Content type"] === "string" ? row.fields["Content type"] : "";
  const lengthRange = row.fields["Desired length range"] ?? "1,500-2,500 words";

  if (!blogTitle || clientIds.length === 0 || !contentType) {
    return NextResponse.json(
      { error: "Record is missing required fields (Blog Title, Client ID, Content type)" },
      { status: 400 },
    );
  }

  // Reset Status to "Queued" so the worker watchdog will pick it up too if
  // n8n drops it again. Increment retry count for observability.
  const nextRetry = (row.fields.webhook_retry_count ?? 0) + 1;
  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { Status: "Queued" }).catch(() => {});
  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, {
    webhook_retry_count: nextRetry,
    webhook_last_retry_at: new Date().toISOString(),
  }).catch(() => {});

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: record_id,
        fields: {
          "Blog Title": blogTitle,
          "Client ID": clientIds,
          "Search intent": searchIntent,
          "Content type": contentType,
          "Desired length range": lengthRange,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const errMsg = `n8n responded ${res.status}: ${errBody.slice(0, 400)}`;
      await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { Status: "Webhook Failed" }).catch(() => {});
      await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { webhook_error: `manual retry: ${errMsg}` }).catch(() => {});
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 });
    }
    return NextResponse.json({ ok: true, retry_count: nextRetry });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { Status: "Webhook Failed" }).catch(() => {});
    await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { webhook_error: `manual retry threw: ${msg}` }).catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
