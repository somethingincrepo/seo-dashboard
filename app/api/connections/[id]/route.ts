import { NextRequest, NextResponse } from "next/server";
import { disconnectConnection, getConnectionPublic } from "@/lib/connections/service";
import { resolveAuth } from "@/lib/connections/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conn = await getConnectionPublic(id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await resolveAuth(conn.client_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({ ok: true, connection: conn });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conn = await getConnectionPublic(id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await resolveAuth(conn.client_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await disconnectConnection(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
