import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import { executeGscQuery } from "@/lib/tools/gsc";

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

    // Save (or clear) the property in Airtable
    await airtablePatch("Clients", client.id, { gsc_property: gscProperty });

    if (!gscProperty) {
      return NextResponse.json({ ok: true, connected: false });
    }

    // Optionally test the connection
    if (body.test_connection) {
      try {
        const end = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
        const start = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
        await executeGscQuery({
          property: gscProperty,
          start_date: start,
          end_date: end,
          row_limit: 1,
        });
        return NextResponse.json({ ok: true, connected: true, verified: true });
      } catch (err) {
        // Saved but couldn't verify — return the raw error so the UI can explain it
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: true, connected: true, verified: false, test_error: msg });
      }
    }

    return NextResponse.json({ ok: true, connected: true });
  } catch (err) {
    console.error("[settings/gsc]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
