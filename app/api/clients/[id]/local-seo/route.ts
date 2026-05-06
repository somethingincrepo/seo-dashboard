import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

const ALLOWED_FIELDS = ["is_local_business", "service_areas"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authed = await getSession();
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body: Partial<Record<AllowedField, unknown>> = await request.json();

    const fields: Record<string, string | boolean> = {};
    if ("is_local_business" in body) {
      fields.is_local_business = Boolean(body.is_local_business);
    }
    if ("service_areas" in body) {
      fields.service_areas = (typeof body.service_areas === "string" ? body.service_areas : "").trim();
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    await airtablePatch("Clients", id, fields);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[local-seo] PATCH error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
