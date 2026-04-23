import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEngainMentions, getEngainMentionStats } from "@/lib/engain";

export async function GET(request: NextRequest) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const mode = searchParams.get("mode") ?? "list"; // "list" | "stats"

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    if (mode === "stats") {
      const stats = await getEngainMentionStats(projectId);
      return NextResponse.json(stats);
    }

    const mentions = await getEngainMentions(projectId, {
      limit: Number(searchParams.get("limit") ?? 20),
      page: Number(searchParams.get("page") ?? 1),
      sentiment: searchParams.get("sentiment") ?? undefined,
      brand: searchParams.get("brand") ?? undefined,
    });
    return NextResponse.json(mentions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not set") || message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
