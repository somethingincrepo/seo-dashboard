import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Module-level token cache — reused across requests within the same serverless instance
let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not configured");
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SEODashboard/1.0 by reporting@somethingincorporated.io",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Reddit OAuth failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function GET(request: NextRequest) {
  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  // Extract subreddit + post ID from permalink
  // Format: https://www.reddit.com/r/{sub}/comments/{id}/...
  const match = permalink.match(/\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
  if (!match) return NextResponse.json({ error: "Invalid Reddit permalink" }, { status: 400 });
  const [, subreddit, postId] = match;

  try {
    const token = await getRedditToken();

    const res = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?limit=5&sort=best&raw_json=1&depth=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "SEODashboard/1.0 by reporting@somethingincorporated.io",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Reddit returned ${res.status}` }, { status: res.status });
    }

    const json = await res.json() as unknown[];
    if (!Array.isArray(json) || json.length < 2) {
      return NextResponse.json({ error: "Unexpected Reddit format" }, { status: 500 });
    }

    const postChildren = ((json[0] as Record<string, unknown>).data as Record<string, unknown>).children as unknown[];
    const post = (postChildren[0] as Record<string, unknown>).data as Record<string, unknown>;

    const commentChildren = ((json[1] as Record<string, unknown>).data as Record<string, unknown>).children as unknown[];
    const comments: Array<{ author: string; body: string; score: number }> = [];

    for (const child of commentChildren.slice(0, 5)) {
      const c = child as Record<string, unknown>;
      if (c.kind !== "t1") continue;
      const cd = c.data as Record<string, unknown>;
      if (!cd.body || cd.body === "[deleted]" || cd.body === "[removed]") continue;
      comments.push({
        author: (cd.author as string) ?? "unknown",
        body: ((cd.body as string) ?? "").slice(0, 600),
        score: (cd.score as number) ?? 0,
      });
    }

    return NextResponse.json({
      title: (post.title as string) ?? "",
      selftext: ((post.selftext as string) ?? "").slice(0, 2000),
      author: (post.author as string) ?? "",
      subreddit: (post.subreddit as string) ?? "",
      score: (post.score as number) ?? 0,
      num_comments: (post.num_comments as number) ?? 0,
      comments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
