// Anonymous Reddit client — emulates the Android app to obtain a bearer token.
// No registration, no API key, no user account required.
// Same technique used by Redlib (open-source Reddit proxy, github.com/redlib-org/redlib).

const REDDIT_ANDROID_CLIENT_ID = "LNDo9s_qHD9gIa4W38UauA";
const MOBILE_UA = "android:com.reddit.frontpage:v2023.21.0 (by /u/anonymous)";

// Module-level token cache — survives across requests within the same function instance.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAnonToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(`${REDDIT_ANDROID_CLIENT_ID}:`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": MOBILE_UA,
    },
    body: "grant_type=https://oauth.reddit.com/grants/installed_client&device_id=DO_NOT_TRACK_THIS_DEVICE",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Reddit token fetch failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  if (!data.access_token) throw new Error("Reddit token response missing access_token");

  // Cache for 23 hours (tokens last 24h; leave 1h buffer)
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };
  console.log("[reddit-client] token refreshed");
  return cachedToken.value;
}

function extractPostId(permalink: string): string | null {
  return permalink.match(/\/comments\/([a-z0-9]+)\//i)?.[1] ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type RedditComment = { author: string; body: string; score: number };
type ThreadResult = {
  selftext: string | null;
  comments: RedditComment[];
  score: number | null;
  num_comments: number | null;
};

function flattenComments(
  children: Array<{ kind: string; data: Record<string, unknown> }>,
  limit = 20
): RedditComment[] {
  const out: RedditComment[] = [];
  for (const child of children) {
    if (out.length >= limit) break;
    if (child.kind !== "t1") continue;
    const d = child.data;
    const body = d.body as string | undefined;
    if (!body || body === "[deleted]" || body === "[removed]") continue;
    out.push({
      author: (d.author as string) ?? "unknown",
      body: body.slice(0, 500),
      score: (d.score as number) ?? 0,
    });
    const replies = d.replies as { data?: { children?: Array<{ kind: string; data: Record<string, unknown> }> } } | string | undefined;
    if (replies && typeof replies === "object" && replies.data?.children) {
      out.push(...flattenComments(replies.data.children, limit - out.length));
    }
  }
  return out;
}

function parseThreadResponse(json: unknown[]): ThreadResult {
  // Reddit returns a 2-element array: [post listing, comments listing]
  const postData = (json[0] as { data: { children: Array<{ data: Record<string, unknown> }> } })
    ?.data?.children?.[0]?.data ?? {};
  const selftext = ((postData.selftext as string) ?? "").trim() || null;
  const rawComments = (json[1] as { data: { children: Array<{ kind: string; data: Record<string, unknown> }> } })
    ?.data?.children ?? [];
  const comments = flattenComments(rawComments);
  comments.sort((a, b) => b.score - a.score);
  return {
    selftext,
    comments: comments.slice(0, 20),
    score: (postData.score as number) ?? null,
    num_comments: (postData.num_comments as number) ?? null,
  };
}

// Primary: oauth.reddit.com with anonymous bearer token
async function fetchViaOAuth(postId: string): Promise<ThreadResult> {
  const token = await getAnonToken();
  const url = `https://oauth.reddit.com/comments/${postId}?limit=50&depth=3&raw_json=1`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": MOBILE_UA,
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as unknown[];
      if (!Array.isArray(json) || json.length < 2) throw new Error("Unexpected response structure");
      return parseThreadResponse(json);
    }

    if (res.status === 401) {
      // Token expired mid-session — clear cache and retry once
      cachedToken = null;
      if (attempt === 0) {
        const newToken = await getAnonToken();
        const retry = await fetch(url, {
          headers: { Authorization: `Bearer ${newToken}`, "User-Agent": MOBILE_UA },
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
        if (retry.ok) {
          const json = (await retry.json()) as unknown[];
          if (!Array.isArray(json) || json.length < 2) throw new Error("Unexpected response structure");
          return parseThreadResponse(json);
        }
      }
    }

    if (res.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }

    throw new Error(`Reddit OAuth returned ${res.status}`);
  }

  throw new Error("Max retries exceeded on oauth.reddit.com");
}

// Fallback: old.reddit.com .json endpoint with browser-like headers
async function fetchViaJson(permalink: string): Promise<ThreadResult> {
  const normalized = permalink.startsWith("http")
    ? permalink
    : `https://www.reddit.com${permalink}`;
  const url = new URL(normalized);
  url.hostname = "old.reddit.com";
  const base = url.toString().replace(/\/$/, "");
  const jsonUrl = `${base}.json?limit=50&depth=3&raw_json=1`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(jsonUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.reddit.com/",
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as unknown[];
      if (!Array.isArray(json) || json.length < 2) throw new Error("Unexpected response structure");
      return parseThreadResponse(json);
    }

    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    throw new Error(`old.reddit.com returned ${res.status}`);
  }

  throw new Error("Max retries exceeded on old.reddit.com");
}

/**
 * Fetches thread content and comments for a Reddit permalink.
 * Tries oauth.reddit.com first (anonymous token), falls back to old.reddit.com .json.
 */
export async function fetchRedditThread(permalink: string): Promise<ThreadResult> {
  const postId = extractPostId(permalink);

  if (postId) {
    try {
      return await fetchViaOAuth(postId);
    } catch (err) {
      console.warn("[reddit-client] OAuth fetch failed, falling back to .json:", err);
    }
  }

  return fetchViaJson(permalink);
}
