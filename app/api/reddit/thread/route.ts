import { NextRequest, NextResponse } from "next/server";

// Edge runtime uses Vercel's edge network (different IPs than serverless — not blocked by Reddit)
export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  try {
    const cleanUrl = permalink.replace(/\/$/, "");
    const jsonUrl = `${cleanUrl}.json?limit=5&depth=1&raw_json=1`;

    const res = await fetch(jsonUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Reddit returned ${res.status}` }, { status: res.status });
    }

    const json = await res.json() as unknown[];
    if (!Array.isArray(json) || json.length < 2) {
      return NextResponse.json({ error: "Unexpected Reddit format" }, { status: 500 });
    }

    // Parse post
    const postChildren = ((json[0] as Record<string, unknown>).data as Record<string, unknown>).children as unknown[];
    const post = ((postChildren[0] as Record<string, unknown>).data as Record<string, unknown>);

    // Parse comments
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
      selftext: ((post.selftext as string) ?? "").slice(0, 1000),
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
