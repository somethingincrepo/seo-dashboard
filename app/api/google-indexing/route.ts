import { NextRequest, NextResponse } from "next/server";
import { airtableFetch } from "@/lib/airtable";
import { batchSubmitUrls, updateIndexingStatusForUrls } from "@/lib/tools/google-indexing";
import type { Change } from "@/lib/changes";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;
  return auth === `Bearer ${expected}`;
}

/**
 * GET /api/google-indexing?client_id=xxx
 * Returns implemented changes for a client with their indexing status.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
  }

  const records = await airtableFetch<Change>("Changes", {
    filterByFormula: `AND(OR(FIND("${clientId}",{client_id}),{client_id}="${clientId}"),{execution_status}="complete")`,
    fields: ["page_url", "type", "cat", "implemented_at", "indexing_status", "indexing_submitted_at", "change_title"] as never[],
    sort: [{ field: "implemented_at", direction: "desc" }],
  });

  const changes = records.map((r) => ({
    id: r.id,
    page_url: r.fields.page_url || "",
    type: r.fields.type || "",
    cat: r.fields.cat || "",
    implemented_at: r.fields.implemented_at || "",
    indexing_status: (r.fields as Record<string, unknown>).indexing_status as string || "not_submitted",
    indexing_submitted_at: (r.fields as Record<string, unknown>).indexing_submitted_at as string || null,
    change_title: r.fields.change_title || "",
  }));

  return NextResponse.json({ changes });
}

/**
 * POST /api/google-indexing
 * Submit URLs to the Google Indexing API.
 * Body: { client_id: string, urls: string[], type?: "URL_UPDATED" | "URL_DELETED" }
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { client_id?: string; urls?: string[]; type?: "URL_UPDATED" | "URL_DELETED" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { urls, type = "URL_UPDATED" } = body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls must be a non-empty array" }, { status: 400 });
  }

  const result = await batchSubmitUrls(urls, type);

  // Update Airtable records async — write succeeded status first, then failed
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
