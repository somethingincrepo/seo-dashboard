import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPortalSession } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export type RedditComment = {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  depth: number;
  replies: RedditComment[];
};

export type ThreadDetail = {
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  comments: RedditComment[];
};

function parseComments(data: unknown, depth = 0): RedditComment[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (d.kind !== "Listing") return [];
  const listing = d.data as Record<string, unknown>;
  const children = (listing.children as unknown[]) ?? [];

  const comments: RedditComment[] = [];
  for (const child of children) {
    const c = child as Record<string, unknown>;
    if (c.kind !== "t1") continue;
    const cd = c.data as Record<string, unknown>;
    if (!cd.body || cd.body === "[deleted]" || cd.body === "[removed]") continue;

    comments.push({
      id: cd.id as string,
      author: (cd.author as string) ?? "[deleted]",
      body: cd.body as string,
      score: (cd.score as number) ?? 0,
      created_utc: (cd.created_utc as number) ?? 0,
      depth,
      replies: parseComments(cd.replies, depth + 1),
    });
  }

  return comments.slice(0, 15);
}

export async function GET(request: NextRequest) {
  const [adminSession, portalSession] = await Promise.all([getSession(), getPortalSession()]);
  if (!adminSession && !portalSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  try {
    const cleanUrl = permalink.replace(/\/$/, "");
    const jsonUrl = `${cleanUrl}.json?limit=20&depth=2`;

    const res = await fetch(jsonUrl, {
      headers: {
        "User-Agent": "SEODashboard/1.0 by SomethingInc",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Reddit returned ${res.status}`);

    const json = await res.json() as unknown[];
    if (!Array.isArray(json) || json.length < 2) throw new Error("Unexpected format");

    const postData = ((json[0] as Record<string, unknown>).data as Record<string, unknown>)
      .children as unknown[];
    const post = ((postData[0] as Record<string, unknown>).data as Record<string, unknown>);

    const detail: ThreadDetail = {
      title: (post.title as string) ?? "",
      selftext: (post.selftext as string) ?? "",
      author: (post.author as string) ?? "",
      subreddit: (post.subreddit as string) ?? "",
      score: (post.score as number) ?? 0,
      upvote_ratio: (post.upvote_ratio as number) ?? 0,
      num_comments: (post.num_comments as number) ?? 0,
      created_utc: (post.created_utc as number) ?? 0,
      url: (post.url as string) ?? "",
      permalink: `https://reddit.com${post.permalink as string}`,
      comments: parseComments(json[1]),
    };

    return NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
