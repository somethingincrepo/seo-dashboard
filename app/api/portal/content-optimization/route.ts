import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import {
  getSupabase,
  getContentRefreshesForClient,
  approveContentRefresh,
  type ContentRefresh,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/portal/content-optimization?token=xxx
// Returns all content refreshes for this client (Supabase only — refreshes do
// not live in the n8n Airtable tables).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const refreshes = await getContentRefreshesForClient(client.id).catch(() => [] as ContentRefresh[]);

  const rank = (r: ContentRefresh) => {
    if (r.status === "completed" && !r.portal_approval) return 0;
    if (r.status === "in_progress" || r.status === "approved") return 1;
    if (r.status === "failed") return 3;
    return 2;
  };

  refreshes.sort((a, b) => rank(a) - rank(b));

  return NextResponse.json({ items: refreshes });
}

// POST /api/portal/content-optimization?token=xxx
// body: { type: "approve", refreshId } — approves the refresh and queues publish.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = (await request.json()) as { type: string; refreshId?: string };

  if (body.type === "approve" && body.refreshId) {
    await approveContentRefresh(body.refreshId);

    // Queue publish_article_wordpress against this refresh on the Fly.io worker
    try {
      const supabase = getSupabase();
      await supabase.from("jobs").insert({
        sop_name: "publish_article_wordpress",
        runner: "fly",
        client_id: client.id,
        status: "pending",
        payload: { content_refresh_id: body.refreshId },
      });
    } catch (err) {
      console.error("Failed to queue publish job (non-fatal):", err);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
