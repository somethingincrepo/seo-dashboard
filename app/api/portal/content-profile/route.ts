import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const companyName = client.fields.company_name;

  const records = await contentAirtableFetch<{
    id: string;
    fields: {
      "Client Name": string;
      "Brand voice summary": string;
      "Style rules": string;
      "Formatting rules": string;
      "Core products/services": string;
      "Positioning/differentiators": string;
      "Primary CTAs": string;
      "Restricted claims/language": string;
      "Priority internal pages": string;
    };
  }>("Clients", { filterByFormula: `{Client Name}="${companyName}"` });

  if (!records.length) {
    return NextResponse.json({ profile: null });
  }

  const f = records[0].fields;
  return NextResponse.json({
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
