import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";
import { executeGscQuery, resolveGscProperty } from "@/lib/tools/gsc";

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

    // When gsc_property is being set, test it and auto-correct the format if needed.
    // This prevents sc-domain: vs URL-prefix mismatches from silently breaking GSC data.
    let gscAutoCorrection: { original: string; resolved: string } | null = null;
    if (fields.gsc_property) {
      const gscProperty = fields.gsc_property;
      const end = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
      const start = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];

      try {
        await executeGscQuery({ property: gscProperty, start_date: start, end_date: end, row_limit: 1 });
        // Property works as-is — no correction needed
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("403")) {
          // Try to resolve the correct accessible property
          const { property: resolved, changed } = await resolveGscProperty(gscProperty);
          if (changed) {
            try {
              // Confirm the resolved property actually works
              await executeGscQuery({ property: resolved, start_date: start, end_date: end, row_limit: 1 });
              fields.gsc_property = resolved;
              gscAutoCorrection = { original: gscProperty, resolved };
              console.log(`[integrations] Auto-corrected gsc_property: ${gscProperty} → ${resolved}`);
            } catch {
              // Resolved property also failed — save what was entered and let runtime handle it
            }
          }
        }
        // Non-403 errors (network, bad format, etc.) — save as entered, don't block
      }
    }

    await airtablePatch("Clients", id, fields);
    return NextResponse.json({
      ok: true,
      ...(gscAutoCorrection ? { gsc_auto_corrected: gscAutoCorrection } : {}),
      gsc_property: fields.gsc_property,
    });
  } catch (e) {
    console.error("[integrations] PATCH error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
