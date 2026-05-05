import { NextRequest, NextResponse } from "next/server";
import { listConnectionsForClient } from "@/lib/connections/service";
import { resolveAuth } from "@/lib/connections/auth-guard";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("client_id") || undefined;

  const auth = await resolveAuth(requested);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const connections = await listConnectionsForClient(auth.clientId);
    return NextResponse.json({ ok: true, connections });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
