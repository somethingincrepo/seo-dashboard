const AIRTABLE_BASE_URL = "https://api.airtable.com/v0";

function getContentHeaders() {
  return {
    Authorization: `Bearer ${process.env.CONTENT_AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6; // 0 = Sun, 6 = Sat
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Fetch all occupied publish dates (YYYY-MM-DD) for articles that are
 * approved and scheduled on or after today — globally across all clients.
 * 1 article per day across the whole system.
 */
export async function getOccupiedPublishDates(): Promise<Set<string>> {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  if (!baseId || !process.env.CONTENT_AIRTABLE_API_KEY) return new Set();

  const today = toDateStr(new Date());
  const url = new URL(`${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent("Results")}`);
  url.searchParams.set(
    "filterByFormula",
    `AND({scheduled_publish_date}>="${today}",{portal_approval}="approved")`
  );
  url.searchParams.append("fields[]", "scheduled_publish_date");
  url.searchParams.set("maxRecords", "500");

  try {
    const res = await fetch(url.toString(), { headers: getContentHeaders(), cache: "no-store" });
    if (!res.ok) return new Set();
    const data = await res.json() as { records: { fields: { scheduled_publish_date?: string } }[] };
    const dates = new Set<string>();
    for (const rec of data.records) {
      const d = rec.fields.scheduled_publish_date;
      if (d) dates.add(d.slice(0, 10));
    }
    return dates;
  } catch {
    return new Set();
  }
}

/**
 * Find the next available weekday publish slot starting from tomorrow.
 * Pass an already-fetched occupied set to avoid double-fetching.
 */
export async function getNextPublishDate(occupied?: Set<string>): Promise<string> {
  const dates = occupied ?? await getOccupiedPublishDates();

  const candidate = new Date();
  candidate.setUTCDate(candidate.getUTCDate() + 1); // start tomorrow

  for (let i = 0; i < 90; i++) {
    if (isWeekday(candidate)) {
      const s = toDateStr(candidate);
      if (!dates.has(s)) return s;
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  // Fallback (should never happen in practice)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return toDateStr(tomorrow);
}

export type ScheduledArticle = {
  id: string;
  title: string;
  scheduled_publish_date: string; // YYYY-MM-DD
  portal_approval: string | null;
};

/**
 * Fetch all scheduled (approved) articles for a specific client.
 * Used to populate the client's calendar view.
 */
export async function getScheduledArticlesForClient(companyName: string): Promise<ScheduledArticle[]> {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  if (!baseId || !process.env.CONTENT_AIRTABLE_API_KEY) return [];

  const escaped = companyName.replace(/"/g, '\\"');
  const url = new URL(`${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent("Results")}`);
  url.searchParams.set(
    "filterByFormula",
    `AND(FIND("${escaped}",ARRAYJOIN({"Client Name (from Client ID) (from Job ID)"},",")),{portal_approval}="approved",{scheduled_publish_date}!="")`
  );
  url.searchParams.append("fields[]", "Article title");
  url.searchParams.append("fields[]", "scheduled_publish_date");
  url.searchParams.append("fields[]", "portal_approval");
  url.searchParams.set("maxRecords", "300");

  try {
    const res = await fetch(url.toString(), { headers: getContentHeaders(), cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json() as { records: { id: string; fields: Record<string, unknown> }[] };
    return data.records
      .filter((r) => r.fields.scheduled_publish_date)
      .map((r) => ({
        id: r.id,
        title: (r.fields["Article title"] as string) || "Untitled",
        scheduled_publish_date: (r.fields.scheduled_publish_date as string).slice(0, 10),
        portal_approval: (r.fields.portal_approval as string | null) ?? null,
      }));
  } catch {
    return [];
  }
}
