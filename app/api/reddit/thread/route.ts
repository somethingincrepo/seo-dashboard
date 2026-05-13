import { NextRequest, NextResponse } from "next/server";
import { fetchRedditThread } from "@/lib/reddit-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  try {
    const result = await fetchRedditThread(permalink);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
