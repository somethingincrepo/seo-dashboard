import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { triggerAudit } from "@/lib/audit/triggerAudit";
import { airtableFetch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.ADMIN_PASSWORD}`) return true;
  const session = await getSession();
  return !!session;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { client_id?: string; root_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { client_id, root_url } = body;
  if (!client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  // Look up client name + nav pages from Airtable for context.
  let clientName = client_id;
  let derivedRoot = root_url ?? "";
  let navUrls: string[] = [];
  try {
    const records = await airtableFetch<{
      id: string;
      fields: { company_name?: string; site_url?: string; nav_pages?: string };
    }>("Clients", { filterByFormula: `RECORD_ID()="${client_id}"`, maxRecords: 1 });
    const c = records[0];
    if (c) {
      clientName = c.fields.company_name ?? clientName;
      derivedRoot = derivedRoot || (c.fields.site_url ?? "");
      const navRaw = c.fields.nav_pages;
      if (navRaw) {
        try {
          const parsed = JSON.parse(navRaw);
          if (Array.isArray(parsed)) navUrls = parsed.filter((x): x is string => typeof x === "string");
        } catch {
          // nav_pages may be newline-separated text
          navUrls = navRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        }
      }
    }
  } catch (e) {
    console.warn("[audit/start] airtable lookup failed:", e);
  }

  if (!derivedRoot) {
    return NextResponse.json({ error: "root_url not provided and not found on client record" }, { status: 400 });
  }

  try {
    const result = await triggerAudit({
      client_id,
      client_name: clientName,
      root_url: derivedRoot,
      triggered_by: "admin_rerun",
      nav_urls: navUrls,
    });
    return NextResponse.json({ ok: true, audit_run_id: result.audit_run_id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
