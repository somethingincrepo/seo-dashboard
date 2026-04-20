import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtablePatch } from "@/lib/airtable";
import { getNextPublishDate } from "@/lib/content-schedule";

const RESULTS_TABLE = "Results";

// POST /api/portal/content-review?token=xxx
// body: { type: "approve_article", resultId }
//       { type: "save_article_body", resultId, body }
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    type: string;
    resultId?: string;
    body?: string;
  };

  try {
    if (body.type === "approve_article" && body.resultId) {
      // Mark approved
      await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
        portal_approval: "approved",
        portal_approved_at: new Date().toISOString(),
      });

      // Assign the next available publish date — the worker's daily publisherTick
      // will queue the actual publish job when that date arrives.
      let scheduledDate: string | null = null;
      try {
        scheduledDate = await getNextPublishDate();
        await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
          scheduled_publish_date: scheduledDate,
        });
      } catch (err) {
        console.error("Failed to assign publish date (non-fatal):", err);
      }

      return NextResponse.json({ ok: true, scheduled_date: scheduledDate });
    }

    if (body.type === "save_article_body" && body.resultId && body.body !== undefined) {
      await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
        "Article body": body.body,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
