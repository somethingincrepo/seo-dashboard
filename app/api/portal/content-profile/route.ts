import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch, contentAirtablePatch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

const FIELD_MAP: Record<string, string> = {
  brand_voice: "Brand voice summary",
  style_rules: "Style rules",
  formatting_rules: "Formatting rules",
  core_services: "Core products/services",
  positioning: "Positioning/differentiators",
  primary_ctas: "Primary CTAs",
  restricted_language: "Restricted claims/language",
  priority_pages: "Priority internal pages",
};

async function getContentRecord(companyName: string) {
  const records = await contentAirtableFetch<{
    id: string;
    fields: Record<string, string>;
  }>("Clients", { filterByFormula: `{Client Name}="${companyName}"` });
  return records[0] ?? null;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const record = await getContentRecord(client.fields.company_name);
  if (!record) return NextResponse.json({ profile: null });

  const f = record.fields;
  return NextResponse.json({
    record_id: record.id,
    profile: {
      brand_voice: f["Brand voice summary"] ?? "",
      style_rules: f["Style rules"] ?? "",
      formatting_rules: f["Formatting rules"] ?? "",
      core_services: f["Core products/services"] ?? "",
      positioning: f["Positioning/differentiators"] ?? "",
      primary_ctas: f["Primary CTAs"] ?? "",
      restricted_language: f["Restricted claims/language"] ?? "",
      priority_pages: f["Priority internal pages"] ?? "",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { record_id: string; field: string; value: string };
  const { record_id, field, value } = body;

  if (!record_id || !field) return NextResponse.json({ error: "record_id and field required" }, { status: 400 });

  const airtableField = FIELD_MAP[field];
  if (!airtableField) return NextResponse.json({ error: "Unknown field" }, { status: 400 });

  await contentAirtablePatch("Clients", record_id, { [airtableField]: value });

  return NextResponse.json({ ok: true });
}
