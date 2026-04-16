import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await getClientByToken(session.portal_token);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let body: {
    wp_username?: string;
    wp_app_password?: string;
    seo_plugin?: string;
    page_builder?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fields: Record<string, string> = {};
  if (body.wp_username !== undefined) fields.wp_username = body.wp_username;
  if (body.wp_app_password !== undefined) fields.wp_app_password = body.wp_app_password;
  if (body.seo_plugin !== undefined) fields.seo_plugin = body.seo_plugin;
  if (body.page_builder !== undefined) fields.page_builder = body.page_builder;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await airtablePatch("Clients", client.id, fields);
  return NextResponse.json({ ok: true });
}
