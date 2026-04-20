import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

const ALLOWED_FIELDS = ["gsc_property", "ga4_property", "sheet_id", "drive_folder_id"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authed = await getSession();
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  } catch (e) {
    console.error("[integrations] PATCH error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
