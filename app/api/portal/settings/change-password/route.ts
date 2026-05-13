import { NextRequest, NextResponse } from "next/server";
import { getPortalSession, hashPassword, verifyPassword } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import { getPortalUserByClientId, upsertPortalUser } from "@/lib/portal-users";

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await getClientByToken(session.portal_token);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let body: { current_password?: string; new_password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { current_password, new_password } = body;
  if (!current_password || !new_password) {
    return NextResponse.json({ error: "current_password and new_password are required" }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  // Verify current password — check Supabase first, fall back to Airtable
  const portalUser = await getPortalUserByClientId(client.id);
  const storedHash = portalUser?.password_hash ?? client.fields.portal_password_hash;
  if (!storedHash) {
    return NextResponse.json({ error: "No password set on this account — contact support" }, { status: 400 });
  }

  const valid = await verifyPassword(current_password, storedHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = await hashPassword(new_password);

  // Update Supabase (authoritative) and Airtable in parallel
  const portalToken = client.fields.portal_token;
  const username = (portalUser?.username ?? client.fields.portal_username ?? "").toLowerCase();
  await Promise.all([
    portalToken && username
      ? upsertPortalUser(client.id, portalToken, username, newHash)
      : Promise.resolve(),
    airtablePatch("Clients", client.id, {
      portal_password_hash: newHash,
      portal_password: new_password,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
