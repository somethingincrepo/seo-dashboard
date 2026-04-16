import { getGoogleAccessToken } from "./google-auth";
import { airtableFetch, airtablePatch } from "@/lib/airtable";

const INDEXING_API = "https://indexing.googleapis.com/v3/urlNotifications:publish";

export type IndexingResult =
  | { url: string; notifyTime: string }
  | { url: string; error: string };

export type BatchResult = {
  succeeded: string[];
  failed: Array<{ url: string; error: string }>;
  quota_warning: boolean;
};

/**
 * Submit a single URL to the Google Indexing API.
 * type "URL_UPDATED" = submit for (re)indexing
 * type "URL_DELETED" = remove from index
 */
export async function submitUrlToIndexingAPI(
  url: string,
  type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<IndexingResult> {
  try {
    const token = await getGoogleAccessToken("indexing");
    const res = await fetch(INDEXING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, type }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { url, error: `HTTP ${res.status}: ${body}` };
    }

    const data = await res.json();
    return { url, notifyTime: data.urlNotificationMetadata?.latestUpdate?.notifyTime ?? new Date().toISOString() };
  } catch (err) {
    return { url, error: String(err) };
  }
}

/**
 * Batch submit up to 100 URLs. Uses Promise.allSettled so one failure
 * doesn't block the rest. Returns quota_warning=true if >= 150 are submitted
 * (Google's limit is 200/day per property).
 */
export async function batchSubmitUrls(
  urls: string[],
  type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<BatchResult> {
  const quota_warning = urls.length >= 150;
  const results = await Promise.allSettled(
    urls.map((url) => submitUrlToIndexingAPI(url, type))
  );

  const succeeded: string[] = [];
  const failed: Array<{ url: string; error: string }> = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const r = result.value;
      if ("notifyTime" in r) {
        succeeded.push(r.url);
      } else {
        failed.push({ url: r.url, error: r.error });
      }
    } else {
      failed.push({ url: "unknown", error: String(result.reason) });
    }
  }

  return { succeeded, failed, quota_warning };
}

/**
 * After a successful submission, write indexing_status back to Airtable
 * for all Changes records matching the given URLs.
 */
export async function updateIndexingStatusForUrls(
  urls: string[],
  status: "submitted" | "failed"
): Promise<void> {
  if (urls.length === 0) return;

  // Fetch Changes records that match these URLs
  const formula =
    urls.length === 1
      ? `{page_url}="${urls[0]}"`
      : `OR(${urls.map((u) => `{page_url}="${u}"`).join(",")})`;

  const records = await airtableFetch<{ id: string; fields: { page_url: string } }>(
    "Changes",
    { filterByFormula: formula, fields: ["page_url"] }
  );

  await Promise.allSettled(
    records.map((rec) =>
      airtablePatch("Changes", rec.id, {
        indexing_status: status,
        indexing_submitted_at: new Date().toISOString(),
      })
    )
  );
}
