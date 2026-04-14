import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtablePatch } from "@/lib/airtable";
import { getContentJobById, getResultForJob } from "@/lib/content";

const RESULTS_TABLE = "Results";

// GET /api/portal/content-review/article?token=xxx&jobId=yyy
// Handled in article/route.ts — see below.
// This file handles POST only.

// POST /api/portal/content-review?token=xxx
// body: { type: "approve_article" | "revise_article", resultId, notes? }
//       { type: "approve_title" | "skip_title", jobId }
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    type: string;
    resultId?: string;
    jobId?: string;
    notes?: string;
  };

  try {
    if (body.type === "approve_article" && body.resultId) {
      await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
        portal_approval: "approved",
        portal_approved_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    if (body.type === "revise_article" && body.resultId) {
      await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
        portal_approval: "needs_revision",
        portal_notes: body.notes ?? "",
        portal_approved_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
