import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import {
  CONTENT_STYLES,
  getContentStyles,
  saveContentStyles,
  type ContentStyleId,
} from "@/lib/content-styles";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;

  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await getContentStyles(client.fields.company_name);

  return NextResponse.json({
    styles: CONTENT_STYLES,
    activeIds: result?.styleIds ?? [],
    recordId: result?.recordId ?? null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;

  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await request.json() as { recordId: string; styleIds: ContentStyleId[] };
  const { recordId, styleIds } = body;

  if (!recordId) return NextResponse.json({ error: "recordId required" }, { status: 400 });
  if (!Array.isArray(styleIds)) return NextResponse.json({ error: "styleIds must be an array" }, { status: 400 });

  // Validate all IDs are known styles
  const validIds = new Set(CONTENT_STYLES.map((s) => s.id));
  const unknown = styleIds.filter((id) => !validIds.has(id));
  if (unknown.length) {
    return NextResponse.json({ error: `Unknown style IDs: ${unknown.join(", ")}` }, { status: 400 });
  }

  await saveContentStyles(recordId, styleIds);
  return NextResponse.json({ ok: true });
}
