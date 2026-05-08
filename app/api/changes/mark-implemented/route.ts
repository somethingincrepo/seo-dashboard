import { NextRequest, NextResponse } from "next/server";
import { airtableFetch } from "@/lib/airtable";
import { markChangeImplemented } from "@/lib/changes";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  let body: { recordId?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { recordId, token } = body;
  if (!recordId || !token) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 403 });

  // Ownership check
  type R = { id: string; fields: { client_id?: string } };
  const records = await airtableFetch<R>("Changes", {
    filterByFormula: `RECORD_ID()="${recordId}"`,
    fields: ["client_id"],
    maxRecords: 1,
  });
  if (!records[0]) return NextResponse.json({ error: "Change not found" }, { status: 404 });

  const clientSlug = (client.fields as Record<string, unknown>).client_id as string | undefined;
  const owner = records[0].fields.client_id;
  if (owner && owner !== clientSlug && owner !== client.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await markChangeImplemented(recordId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("mark-implemented failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
