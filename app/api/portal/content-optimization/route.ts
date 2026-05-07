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

  const body = (await request.json()) as {
    type: string;
    refreshId?: string;
    field?: string;
    value?: string;
  };

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

  // Edit a proposed_* field on a content_refreshes row before the customer
  // approves. Whatever the customer ends up approving is what gets published —
  // so this gives them direct control over the final copy without needing to
  // bounce changes back through the LLM.
  if (body.type === "edit_proposed" && body.refreshId && body.field && typeof body.value === "string") {
    const ALLOWED_FIELDS = new Set(["proposed_meta_title", "proposed_meta_description", "proposed_body"]);
    if (!ALLOWED_FIELDS.has(body.field)) {
      return NextResponse.json({ error: `Field not editable: ${body.field}` }, { status: 400 });
    }
    // Verify ownership: the refresh must belong to this client.
    const supabase = getSupabase();
    const { data: row, error: fetchErr } = await supabase
      .from("content_refreshes")
      .select("id, client_id, status")
      .eq("id", body.refreshId)
      .single();
    if (fetchErr || !row) {
      return NextResponse.json({ error: "Refresh not found" }, { status: 404 });
    }
    if (row.client_id !== client.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (row.status !== "completed") {
      return NextResponse.json({ error: `Cannot edit a refresh in status "${row.status}"` }, { status: 409 });
    }
    const { error: updateErr } = await supabase
      .from("content_refreshes")
      .update({ [body.field]: body.value, updated_at: new Date().toISOString() })
      .eq("id", body.refreshId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
