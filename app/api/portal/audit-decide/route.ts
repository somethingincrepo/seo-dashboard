import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/portal/audit-decide?token=xxx
// body: { issue_ids: string[], decision: "approved" | "dismissed" | null }
// Marks 1..N issues with the given decision. Issues must belong to the
// authenticated client (we filter on client_id in the UPDATE so a forged
// id from a different client can't be touched).
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: { issue_ids?: string[]; decision?: "approved" | "dismissed" | null };
  try {
    body = (await request.json()) as { issue_ids?: string[]; decision?: "approved" | "dismissed" | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = (body.issue_ids ?? []).filter((s) => typeof s === "string" && s.length > 0);
  const decision = body.decision === "approved" || body.decision === "dismissed" ? body.decision : null;

  if (ids.length === 0) {
    return NextResponse.json({ error: "issue_ids required" }, { status: 400 });
  }
  // Sanity cap to avoid abuse
  if (ids.length > 5000) {
    return NextResponse.json({ error: "Too many issue_ids in one request" }, { status: 400 });
  }

  const supabase = getSupabase();
  const recordId = client.id;
  const now = new Date().toISOString();
  const decidedBy = client.fields.contact_email ?? client.fields.client_id ?? "portal";

  const update = decision === null
    ? { decision: null, decided_at: null, decided_by: null }
    : { decision, decided_at: now, decided_by: decidedBy };

  const { error, count } = await supabase
    .from("issues")
    .update(update, { count: "exact" })
    .eq("client_id", recordId)
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: count ?? ids.length, decision });
}
