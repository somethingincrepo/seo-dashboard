import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { airtableFetch } from "@/lib/airtable";
import { batchSubmitUrls, updateIndexingStatusForUrls } from "@/lib/tools/google-indexing";
import type { Change } from "@/lib/changes";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/indexation?token=xxx
 * Returns implemented changes for the token's client with indexing status.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;

  const records = await airtableFetch<Change>("Changes", {
    filterByFormula: `AND(OR(FIND("${clientId}",{client_id}),FIND("${recordId}",{client_id})),{execution_status}="complete")`,
    fields: ["page_url", "type", "cat", "implemented_at", "indexing_status", "indexing_submitted_at", "change_title"] as never[],
    sort: [{ field: "implemented_at", direction: "desc" }],
  });

  const changes = records
    .filter((r) => r.fields.page_url)
    .map((r) => ({
      id: r.id,
      page_url: r.fields.page_url || "",
      type: r.fields.type || "",
      cat: r.fields.cat || r.fields.category || "",
      implemented_at: r.fields.implemented_at || "",
      indexing_status: (r.fields as Record<string, unknown>).indexing_status as string || "not_submitted",
      indexing_submitted_at: (r.fields as Record<string, unknown>).indexing_submitted_at as string | null || null,
      change_title: r.fields.change_title || "",
    }));

  return NextResponse.json({ changes });
}

/**
 * POST /api/portal/indexation
 * Submit URLs from the portal.
 * Body: { token: string, urls: string[] }
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; urls?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, urls } = body;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls must be a non-empty array" }, { status: 400 });
  }

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const result = await batchSubmitUrls(urls, "URL_UPDATED");

  const writePromises = [];
  if (result.succeeded.length > 0) {
    writePromises.push(updateIndexingStatusForUrls(result.succeeded, "submitted"));
  }
  if (result.failed.length > 0) {
    writePromises.push(
      updateIndexingStatusForUrls(result.failed.map((f) => f.url), "failed")
    );
  }
  await Promise.allSettled(writePromises);

  return NextResponse.json({
    succeeded: result.succeeded,
    failed: result.failed,
    quota_warning: result.quota_warning,
  });
}
