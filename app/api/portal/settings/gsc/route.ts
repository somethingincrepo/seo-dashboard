import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import { executeGscQuery, resolveGscProperty } from "@/lib/tools/gsc";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getPortalSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await getClientByToken(session.portal_token);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    let body: { gsc_property?: string; test_connection?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const gscProperty = (body.gsc_property ?? "").trim();

    if (!gscProperty) {
      await airtablePatch("Clients", client.id, { gsc_property: "" });
      return NextResponse.json({ ok: true, connected: false });
    }

    // Save the property as entered first
    await airtablePatch("Clients", client.id, { gsc_property: gscProperty });

    if (!body.test_connection) {
      return NextResponse.json({ ok: true, connected: true });
    }

    // Test the connection — and auto-correct the stored format if needed
    const end = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
    const start = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];

    try {
      await executeGscQuery({ property: gscProperty, start_date: start, end_date: end, row_limit: 1 });
      return NextResponse.json({ ok: true, connected: true, verified: true, gsc_property: gscProperty });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // On 403: try to find and save the correct accessible property format
      if (msg.includes("403")) {
        try {
          const { property: resolved, changed } = await resolveGscProperty(gscProperty);
          if (changed) {
            // Test the resolved property to confirm it works
            await executeGscQuery({ property: resolved, start_date: start, end_date: end, row_limit: 1 });
            // It works — update the stored value
            await airtablePatch("Clients", client.id, { gsc_property: resolved });
            return NextResponse.json({
              ok: true, connected: true, verified: true,
              gsc_property: resolved,
              auto_corrected: true,
              original_property: gscProperty,
            });
          }
        } catch {
          // Resolution also failed — fall through to the error response
        }
      }

      return NextResponse.json({ ok: true, connected: true, verified: false, test_error: msg });
    }
  } catch (err) {
    console.error("[settings/gsc]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
