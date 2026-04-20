import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";

const ALLOWED_FIELDS = ["gsc_property", "ga4_property", "sheet_id", "drive_folder_id"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: Partial<Record<AllowedField, string>> = await request.json();

  const fields: Record<string, string> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) fields[key] = (body[key] ?? "").trim();
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  await airtablePatch("Clients", id, fields);
  return NextResponse.json({ ok: true });
}
