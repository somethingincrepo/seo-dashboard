import { NextRequest, NextResponse } from "next/server";
import { getConnectionPublic, verifyConnection } from "@/lib/connections/service";
import { resolveAuth } from "@/lib/connections/auth-guard";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conn = await getConnectionPublic(id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await resolveAuth(conn.client_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await verifyConnection(id);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, reason: "unknown", error: msg }, { status: 500 });
  }
}
