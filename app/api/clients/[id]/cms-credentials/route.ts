import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

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

  await airtablePatch("Clients", id, fields);
  return NextResponse.json({ ok: true });
}
