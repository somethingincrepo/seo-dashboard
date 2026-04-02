const BASE_URL = "https://api.airtable.com/v0";

function getContentHeaders() {
  if (!process.env.CONTENT_AIRTABLE_API_KEY) {
    throw new Error("CONTENT_AIRTABLE_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.CONTENT_AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function buildContentUrl(tableId: string, params?: { filterByFormula?: string }, offset?: string): string {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  const url = new URL(`${BASE_URL}/${baseId}/${encodeURIComponent(tableId)}`);
  if (params?.filterByFormula) {
    url.searchParams.set("filterByFormula", params.filterByFormula);
  }
  if (offset) {
    url.searchParams.set("offset", offset);
  }
  return url.toString();
}

async function contentFetch<T>(tableId: string, params?: { filterByFormula?: string }): Promise<T[]> {
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

// ── Types ────────────────────────────────────────────────────────────────────

export type ContentResultFields = {
  "Client Name": string;
  "Blog Title": string;
  Slug: string;
  Body: string;          // HTML or markdown body from n8n pipeline
  "Meta Title": string;
  "Meta Description": string;
  Status: string;        // Queued | In Progress | Completed | Failed
  portal_approval: string | null;   // approved | needs_revision | null = pending
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
 * Fetch all Completed results for a client by name.
 * Case-insensitive: tries exact match first, then lowercased comparison is done client-side.
 */
export async function getContentResultsForClient(companyName: string): Promise<ContentResult[]> {
  // Airtable formula is case-insensitive for LOWER() comparisons
  const filter = `AND({Status}='Completed',LOWER({Client Name})='${companyName.toLowerCase().replace(/'/g, "\\'")}')`;
  return contentFetch<ContentResult>("Results", { filterByFormula: filter });
}

/**
 * Update the portal approval fields on a Results record.
 */
export async function updateContentApproval(
  recordId: string,
  decision: "approved" | "needs_revision",
  notes?: string
): Promise<void> {
  const fields: Record<string, unknown> = {
    portal_approval: decision,
    portal_approved_at: new Date().toISOString(),
  };
  if (notes) fields.portal_notes = notes;
  await contentPatch("Results", recordId, fields);
}
