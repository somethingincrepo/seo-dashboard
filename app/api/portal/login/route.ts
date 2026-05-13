import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { verifyPassword, createPortalSession } from "@/lib/portal-auth";
import { getPortalUserByClientId } from "@/lib/portal-users";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return NextResponse.json(
      { error: "token and password are required" },
      { status: 400 }
    );
  }

  const client = await getClientByToken(token);
  if (!client) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check Supabase first, fall back to Airtable hash
  const portalUser = await getPortalUserByClientId(client.id);
  const hash = portalUser?.password_hash ?? client.fields.portal_password_hash;
  const username = portalUser?.username ?? client.fields.portal_username ?? client.fields.client_id ?? "";

  if (!hash) {
    return NextResponse.json({ error: "Portal not configured" }, { status: 401 });
  }

  const valid = await verifyPassword(password, hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createPortalSession({
    client_id: client.id,
    portal_token: client.fields.portal_token,
    username,
  });

  return NextResponse.json({ ok: true, client_id: client.id });
}
