import { NextRequest, NextResponse } from "next/server";
import { fetchRedditThread } from "@/lib/reddit-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  const crawlerUrl = process.env.CRAWLER_SERVICE_URL || "https://something-audit-crawler.fly.dev";
  const crawlerToken = process.env.CRAWLER_SERVICE_TOKEN;

  // Prefer the Fly.io crawler — it uses a real browser on a non-Vercel IP,
  // bypassing the Reddit blocks that affect server-side fetch from AWS/Vercel.
  if (crawlerToken) {
    try {
      const res = await fetch(
        `${crawlerUrl}/reddit-thread?url=${encodeURIComponent(permalink)}`,
        {
          headers: { Authorization: `Bearer ${crawlerToken}` },
          signal: AbortSignal.timeout(30_000),
        }
      );
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? `Crawler returned ${res.status}`);
      return NextResponse.json(data);
    } catch (err) {
      console.warn("[reddit/thread] crawler failed, falling back:", err instanceof Error ? err.message : err);
    }
  }

  // Fallback: OAuth token + old.reddit.com .json (may be blocked from Vercel IPs)
  try {
    const result = await fetchRedditThread(permalink);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
