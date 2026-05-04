import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/portal/audit-edit-fix?token=xxx
// body: { issue_id: string, proposed_value: string }
// Lets a portal user tweak the agent-generated copy before approving.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: { issue_id?: string; proposed_value?: string };
  try {
    body = (await request.json()) as { issue_id?: string; proposed_value?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.issue_id || typeof body.issue_id !== "string") {
    return NextResponse.json({ error: "issue_id required" }, { status: 400 });
  }
  if (typeof body.proposed_value !== "string") {
    return NextResponse.json({ error: "proposed_value required" }, { status: 400 });
  }
  // Cap to keep someone from stuffing large blobs in here.
  if (body.proposed_value.length > 50_000) {
    return NextResponse.json({ error: "proposed_value too large" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("issues")
    .update({ proposed_value: body.proposed_value })
    .eq("client_id", client.id)
    .eq("id", body.issue_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
