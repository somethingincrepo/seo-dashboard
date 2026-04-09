const BASE_URL = "https://api.airtable.com/v0";

function getContentHeaders() {
  return {
    Authorization: `Bearer ${process.env.CONTENT_AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function buildContentUrl(tableId: string, params?: { filterByFormula?: string; sort?: string }, offset?: string): string {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  const url = new URL(`${BASE_URL}/${baseId}/${encodeURIComponent(tableId)}`);
  if (params?.filterByFormula) {
    url.searchParams.set("filterByFormula", params.filterByFormula);
  }
  if (params?.sort) {
    url.searchParams.set("sort", params.sort);
  }
  if (offset) {
    url.searchParams.set("offset", offset);
  }
  return url.toString();
}

async function contentFetch<T>(tableId: string, params?: { filterByFormula?: string; sort?: string }): Promise<T[]> {
  const records: T[] = [];
  let offset: string | undefined;

  do {
    const res = await fetch(buildContentUrl(tableId, params, offset), {
      headers: getContentHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Content Airtable ${res.status}: ${err}`);
    }
    const data = await res.json();
    records.push(...(data.records as T[]));
    offset = data.offset;
  } while (offset);

  return records;
}

async function contentPatch(tableId: string, recordId: string, fields: Record<string, unknown>): Promise<void> {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  const res = await fetch(`${BASE_URL}/${baseId}/${encodeURIComponent(tableId)}/${recordId}`, {
    method: "PATCH",
    headers: getContentHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Content Airtable patch error ${res.status}: ${err}`);
  }
}

// ── Content Jobs Types ──────────────────────────────────────────────────────

export type ContentJobFields = {
  "Blog Title": string;
  "Content type": string;
  "Search intent": string;
  "Target persona": string;
  "Desired length range": string;
  Status: string; // Queued | In Progress | Completed | Failed
  title_status: string | null; // titled | approved | skipped | generating | completed | published
  target_keyword: string | null;
  keyword_group: string | null;
  content_angle: string | null;
  quality_score: number | null;
  proposed_at: string | null;
  approved_at: string | null;
  "Client ID": string[];
  "Created At": string;
};

export type ContentJob = {
  id: string;
  fields: ContentJobFields;
};

// ── Content Results Types ───────────────────────────────────────────────────

export type ContentResultFields = {
  "Client Name": string;
  "Blog Title": string;
  Slug: string;
  Body: string;
  "Meta Title": string;
  "Meta Description": string;
  Status: string;
  portal_approval: string | null;
  portal_notes: string | null;
  portal_approved_at: string | null;
  "Content Type": string;
  Intent: string;
  "Target Persona": string;
  "Created At": string;
};

export type ContentResult = {
  id: string;
  fields: ContentResultFields;
};

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all Content Jobs for a client.
 */
export async function getContentJobsForClient(companyName: string): Promise<ContentJob[]> {
  if (!process.env.CONTENT_AIRTABLE_API_KEY || !process.env.CONTENT_AIRTABLE_BASE_ID) {
    return [];
  }
  // Use FIND+ARRAYJOIN — {Client Name (from Client ID)} is a lookup array field,
  // exact-match with LOWER() doesn't work reliably on array fields
  const escaped = companyName.replace(/"/g, '\\"');
  const filter = `FIND("${escaped}", ARRAYJOIN({Client Name (from Client ID)}, ","))`;
  return contentFetch<ContentJob>("Content Jobs", { filterByFormula: filter, sort: "{Created At} DESC" });
}

/**
 * Fetch all Completed results for a client by name.
 */
export async function getContentResultsForClient(companyName: string): Promise<ContentResult[]> {
  if (!process.env.CONTENT_AIRTABLE_API_KEY || !process.env.CONTENT_AIRTABLE_BASE_ID) {
    return [];
  }
  const filter = `AND({Status}='Completed',LOWER({Client Name})='${companyName.toLowerCase().replace(/'/g, "\\'")}')`;
  return contentFetch<ContentResult>("Results", { filterByFormula: filter, sort: "{Created At} DESC" });
}

/**
 * Fetch a single result by Job ID (linked record lookup).
 */
export async function getResultByJobTitle(companyName: string, blogTitle: string): Promise<ContentResult | null> {
  if (!process.env.CONTENT_AIRTABLE_API_KEY || !process.env.CONTENT_AIRTABLE_BASE_ID) {
    return null;
  }
  const filter = `AND({Status}='Completed',{Blog Title}='${blogTitle.replace(/'/g, "\\'")}')`;
  const results = await contentFetch<ContentResult>("Results", { filterByFormula: filter, sort: "{Created At} DESC" });
  return results[0] || null;
}

/**
 * Update title_status on a Content Job (approve or skip a title).
 */
export async function updateContentJobTitleStatus(recordId: string, titleStatus: "approved" | "skipped"): Promise<void> {
  const fields: Record<string, unknown> = { title_status: titleStatus };
  if (titleStatus === "approved") {
    fields.approved_at = new Date().toISOString();
  }
  await contentPatch("Content Jobs", recordId, fields);
}

/**
 * Update portal approval on a Content Result (approve or skip an article).
 */
export async function updateContentResultApproval(
  recordId: string,
  decision: "approved" | "needs_revision"
): Promise<void> {
  const fields: Record<string, unknown> = {
    portal_approval: decision,
    portal_approved_at: new Date().toISOString(),
  };
  await contentPatch("Results", recordId, fields);
}

// ── Client-side API wrappers ─────────────────────────────────────────────────

export async function approveContentJob(recordId: string, action: "approved" | "skipped") {
  const res = await fetch("/api/content-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, action, type: "job" }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update job");
  }
}

export async function approveContentResult(recordId: string, action: "approved" | "needs_revision") {
  const res = await fetch("/api/content-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, action, type: "result" }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update result");
  }
}
