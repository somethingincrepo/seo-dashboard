import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { airtablePatch } from "@/lib/airtable";
import { getClient } from "@/lib/clients";
import { hashPassword } from "@/lib/portal-auth";
import { getSession } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const username = client.fields.client_id;
  if (!username) {
    return NextResponse.json({ error: "Client has no client_id slug" }, { status: 400 });
  }

  // 12 random bytes → 16-char base64url string
  const password = randomBytes(12).toString("base64url");
  const hash = await hashPassword(password);

  await airtablePatch("Clients", id, {
    portal_username: username,
    portal_password_hash: hash,
  });

  return NextResponse.json({ username, password });
}
