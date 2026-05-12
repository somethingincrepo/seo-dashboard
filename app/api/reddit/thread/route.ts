import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  const crawlerUrl = process.env.CRAWLER_SERVICE_URL || "https://something-audit-crawler.fly.dev";
  const crawlerToken = process.env.CRAWLER_SERVICE_TOKEN;

  if (!crawlerToken) {
    return NextResponse.json({ error: "Crawler not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${crawlerUrl}/reddit-thread?url=${encodeURIComponent(permalink)}`,
      {
        headers: { Authorization: `Bearer ${crawlerToken}` },
        signal: AbortSignal.timeout(20_000),
      }
    );

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? `Error ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
