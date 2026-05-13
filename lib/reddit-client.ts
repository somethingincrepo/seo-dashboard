// Reddit data client.
// Primary: PullPush.io (public Pushshift archive — no auth, no IP blocking, works from any server).
// Fallback: old.reddit.com .json with browser-like headers (best-effort).

type RedditComment = { author: string; body: string; score: number };
type ThreadResult = {
  selftext: string | null;
  comments: RedditComment[];
  score: number | null;
  num_comments: number | null;
};

function extractPostId(permalink: string): string | null {
  return permalink.match(/\/comments\/([a-z0-9]+)\//i)?.[1] ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── PullPush.io (primary) ────────────────────────────────────────────────────
// Public Pushshift-based archive. Accessible from any IP. No auth required.
// Covers all Reddit content. May lag a few weeks behind for very recent posts.

async function fetchViaPullPush(postId: string): Promise<ThreadResult> {
  const [postRes, commentsRes] = await Promise.all([
    fetch(
      `https://api.pullpush.io/reddit/search/submission/?ids=${postId}&limit=1`,
      { signal: AbortSignal.timeout(12_000), cache: "no-store" }
    ),
    fetch(
      `https://api.pullpush.io/reddit/search/comment/?link_id=${postId}&limit=25&sort=score`,
      { signal: AbortSignal.timeout(12_000), cache: "no-store" }
    ),
  ]);

  if (!postRes.ok) throw new Error(`PullPush posts returned ${postRes.status}`);
  if (!commentsRes.ok) throw new Error(`PullPush comments returned ${commentsRes.status}`);

  const postJson = await postRes.json() as { data?: Array<Record<string, unknown>> };
  const commentsJson = await commentsRes.json() as { data?: Array<Record<string, unknown>> };

  const post = postJson.data?.[0];
  const selftext = ((post?.selftext as string) ?? "").trim() || null;

  const comments: RedditComment[] = (commentsJson.data ?? [])
    .filter((c) => {
      const body = c.body as string | undefined;
      return body && body !== "[deleted]" && body !== "[removed]" && body.length > 0;
    })
    .slice(0, 20)
    .map((c) => ({
      author: (c.author as string) ?? "unknown",
      body: ((c.body as string) ?? "").slice(0, 500),
      score: (c.score as number) ?? 0,
    }));

  // PullPush always returns something (even empty arrays) — check we got data
  if (!post && comments.length === 0) {
    throw new Error("PullPush returned no data for this post");
  }

  return {
    selftext,
    comments,
    score: (post?.score as number) ?? null,
    num_comments: (post?.num_comments as number) ?? null,
  };
}

// ─── old.reddit.com .json fallback ───────────────────────────────────────────
// Less reliable from datacenter IPs, but kept as a last resort.

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

async function fetchViaJson(permalink: string): Promise<ThreadResult> {
  const normalized = permalink.startsWith("http") ? permalink : `https://www.reddit.com${permalink}`;
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
        Referer: "https://www.reddit.com/",
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as unknown[];
      if (!Array.isArray(json) || json.length < 2) throw new Error("Unexpected response structure");
      const postData = (json[0] as { data: { children: Array<{ data: Record<string, unknown> }> } })?.data?.children?.[0]?.data ?? {};
      const selftext = ((postData.selftext as string) ?? "").trim() || null;
      const rawComments = (json[1] as { data: { children: Array<{ kind: string; data: Record<string, unknown> }> } })?.data?.children ?? [];
      const comments = flattenComments(rawComments);
      comments.sort((a, b) => b.score - a.score);
      return { selftext, comments: comments.slice(0, 20), score: (postData.score as number) ?? null, num_comments: (postData.num_comments as number) ?? null };
    }

    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    throw new Error(`old.reddit.com returned ${res.status}`);
  }

  throw new Error("Max retries on old.reddit.com");
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Fetches thread content + top comments for a Reddit permalink.
 * Uses PullPush.io (archive, no IP blocking) first, falls back to old.reddit.com .json.
 */
export async function fetchRedditThread(permalink: string): Promise<ThreadResult> {
  const postId = extractPostId(permalink);

  if (postId) {
    try {
      return await fetchViaPullPush(postId);
    } catch (err) {
      console.warn("[reddit-client] PullPush failed:", err instanceof Error ? err.message : err);
    }
  }

  return fetchViaJson(permalink);
}
