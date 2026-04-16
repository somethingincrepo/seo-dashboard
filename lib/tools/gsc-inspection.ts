import { getGoogleAccessToken } from "./google-auth";
import { airtableFetch, airtablePatch } from "@/lib/airtable";

const INSPECTION_API =
  "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

/** How long before a checked URL is considered stale and should be re-checked */
export const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ────────────────────────────────────────────────────────────────────

export type GscVerdict = "PASS" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED";

/**
 * The raw coverage state string returned by Google. These are the documented
 * values; there may be additional undocumented ones — the string type handles those.
 */
export type GscCoverageState =
  | "Submitted and indexed"
  | "Indexed, though blocked by robots.txt"
  | "Crawled - currently not indexed"
  | "Discovered - currently not indexed"
  | "URL is unknown to Google"
  | "Excluded by 'noindex' tag"
  | "Blocked by robots.txt"
  | "Alternate page with proper canonical tag"
  | "Duplicate without user-selected canonical"
  | "Not found (404)"
  | "Soft 404"
  | string;

export type GscInspectionResult = {
  url: string;
  verdict: GscVerdict;
  coverageState: GscCoverageState;
  lastCrawlTime: string | null;
  robotsTxtState: string;
  indexingState: string;
  inspectionLink: string | null;
  error?: string;
};

// ─── Single URL inspection ─────────────────────────────────────────────────

export async function inspectUrl(
  url: string,
  siteUrl: string
): Promise<GscInspectionResult> {
  try {
    const token = await getGoogleAccessToken(); // webmasters.readonly scope
    const res = await fetch(INSPECTION_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
    });

    if (!res.ok) {
      const body = await res.text();
      return errorResult(url, `HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    const r = data.inspectionResult?.indexStatusResult ?? {};

    return {
      url,
      verdict: (r.verdict as GscVerdict) ?? "VERDICT_UNSPECIFIED",
      coverageState: (r.coverageState as GscCoverageState) ?? "URL is unknown to Google",
      lastCrawlTime: (r.lastCrawlTime as string) ?? null,
      robotsTxtState: (r.robotsTxtState as string) ?? "UNKNOWN",
      indexingState: (r.indexingState as string) ?? "UNKNOWN",
      inspectionLink: (data.inspectionResult?.inspectionResultLink as string) ?? null,
    };
  } catch (err) {
    return errorResult(url, String(err));
  }
}

function errorResult(url: string, error: string): GscInspectionResult {
  return {
    url,
    verdict: "VERDICT_UNSPECIFIED",
    coverageState: "URL is unknown to Google",
    lastCrawlTime: null,
    robotsTxtState: "UNKNOWN",
    indexingState: "UNKNOWN",
    inspectionLink: null,
    error,
  };
}

// ─── Batch inspection (parallel, capped) ─────────────────────────────────────

/**
 * Inspect multiple URLs in parallel against a GSC property.
 * Caps at maxUrls (default 20) to stay within rate limits.
 * Filters to stale URLs unless force=true.
 */
export async function batchInspectUrls(
  entries: Array<{ url: string; lastChecked: string | null }>,
  siteUrl: string,
  options: { force?: boolean; maxUrls?: number } = {}
): Promise<GscInspectionResult[]> {
  const { force = false, maxUrls = 20 } = options;

  const candidates = force
    ? entries
    : entries.filter((e) => isStale(e.lastChecked));

  const batch = candidates.slice(0, maxUrls);
  if (batch.length === 0) return [];

  // Run in parallel — 2000/day quota makes this safe for typical usage
  const results = await Promise.allSettled(
    batch.map((e) => inspectUrl(e.url, siteUrl))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : errorResult(batch[i].url, String(r.reason))
  );
}

// ─── Stale check ──────────────────────────────────────────────────────────────

export function isStale(lastChecked: string | null): boolean {
  if (!lastChecked) return true;
  return Date.now() - new Date(lastChecked).getTime() > STALE_MS;
}

// ─── Write results back to Airtable ───────────────────────────────────────────

/**
 * Write GSC inspection results back to Airtable Changes records.
 * urlToRecordIds maps URL → array of Change record IDs (multiple changes may
 * share the same page_url).
 */
export async function writeInspectionResults(
  results: GscInspectionResult[],
  urlToRecordIds: Map<string, string[]>
): Promise<void> {
  const patches: Promise<unknown>[] = [];

  for (const result of results) {
    const ids = urlToRecordIds.get(result.url) ?? [];
    for (const id of ids) {
      patches.push(
        airtablePatch("Changes", id, {
          gsc_coverage_state: result.error ? null : result.coverageState,
          gsc_verdict: result.error ? null : result.verdict,
          gsc_last_checked: new Date().toISOString(),
          gsc_last_crawled: result.lastCrawlTime ?? null,
        }).catch(() => {}) // non-fatal
      );
    }
  }

  await Promise.allSettled(patches);
}

// ─── Coverage state → display label ───────────────────────────────────────────

export type GscDisplayStatus =
  | "indexed"
  | "not_indexed"
  | "discovered"
  | "blocked"
  | "unknown"
  | "unchecked";

export function coverageStateToDisplay(
  coverageState: GscCoverageState | null | undefined,
  verdict: GscVerdict | null | undefined
): GscDisplayStatus {
  if (!coverageState) return "unchecked";

  if (verdict === "PASS" || coverageState.toLowerCase().includes("indexed and")) return "indexed";
  if (coverageState === "Submitted and indexed") return "indexed";
  if (coverageState === "Indexed, though blocked by robots.txt") return "indexed"; // technically indexed
  if (coverageState === "Crawled - currently not indexed") return "not_indexed";
  if (coverageState === "Discovered - currently not indexed") return "discovered";
  if (
    coverageState === "URL is unknown to Google" ||
    coverageState === "Not found (404)" ||
    coverageState === "Soft 404"
  ) return "unknown";
  if (
    coverageState.toLowerCase().includes("noindex") ||
    coverageState.toLowerCase().includes("robots") ||
    coverageState.toLowerCase().includes("blocked")
  ) return "blocked";
  if (coverageState === "Alternate page with proper canonical tag") return "not_indexed";

  // PASS = indexed, FAIL = problem, NEUTRAL = not indexed/other
  if (verdict === "PASS") return "indexed";
  if (verdict === "FAIL") return "blocked";
  return "not_indexed";
}
