import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { airtableFetch } from "@/lib/airtable";
import {
  batchInspectUrls,
  writeInspectionResults,
  isStale,
} from "@/lib/tools/gsc-inspection";
import type { Change } from "@/lib/changes";

export const dynamic = "force-dynamic";

/**
 * POST /api/portal/indexation/inspect
 *
 * Runs the Google URL Inspection API for implemented changes on this client.
 * On each call it:
 *   1. Loads all implemented changes with page_url
 *   2. Filters to stale records (not checked in 24h) unless force=true
 *   3. Caps at 20 URLs per call to stay within rate limits
 *   4. Writes results back to Airtable
 *   5. Returns updated per-URL GSC status
 *
 * Body: { token: string, urls?: string[], force?: boolean }
 *   urls  — optional subset to check (e.g. single-row refresh)
 *   force — skip stale check and re-inspect everything in the batch
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; urls?: string[]; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, urls: urlsFilter, force = false } = body;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const gscProperty = client.fields.gsc_property;
  if (!gscProperty) {
    return NextResponse.json(
      { error: "No GSC property configured for this client", results: [] },
      { status: 200 } // soft failure — don't break the page
    );
  }

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;

  // Fetch implemented changes
  const records = await airtableFetch<Change>("Changes", {
    filterByFormula: `AND(OR(FIND("${clientId}",{client_id}),FIND("${recordId}",{client_id})),{execution_status}="complete",{page_url}!="")`,
    fields: ["page_url", "gsc_last_checked"] as never[],
  });

  // Build url → record IDs map (multiple changes can share a URL)
  const urlToRecordIds = new Map<string, string[]>();
  const urlToLastChecked = new Map<string, string | null>();

  for (const rec of records) {
    const url = rec.fields.page_url;
    if (!url) continue;

    // If a specific URL list was requested, filter to those only
    if (urlsFilter && !urlsFilter.includes(url)) continue;

    if (!urlToRecordIds.has(url)) {
      urlToRecordIds.set(url, []);
      const lastChecked = (rec.fields as Record<string, unknown>).gsc_last_checked as string | null ?? null;
      urlToLastChecked.set(url, lastChecked);
    }
    urlToRecordIds.get(url)!.push(rec.id);
  }

  const entries = Array.from(urlToRecordIds.keys()).map((url) => ({
    url,
    lastChecked: urlToLastChecked.get(url) ?? null,
  }));

  if (entries.length === 0) {
    return NextResponse.json({ results: [], checked: 0 });
  }

  // Run inspections (capped at 20, filtered to stale unless force)
  const results = await batchInspectUrls(entries, gscProperty, { force, maxUrls: 20 });

  if (results.length === 0) {
    // Nothing was stale — return current state from Airtable without writing
    const currentState = entries.map((e) => ({
      url: e.url,
      stale: false,
      lastChecked: e.lastChecked,
    }));
    return NextResponse.json({ results: [], checked: 0, upToDate: currentState });
  }

  // Write back to Airtable (non-blocking from the response)
  await writeInspectionResults(results, urlToRecordIds);

  return NextResponse.json({
    checked: results.length,
    results: results.map((r) => ({
      url: r.url,
      verdict: r.verdict,
      coverageState: r.coverageState,
      lastCrawlTime: r.lastCrawlTime,
      error: r.error ?? null,
    })),
  });
}
