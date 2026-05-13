import { NextRequest, NextResponse } from "next/server";
import { getSession, verifyBearer } from "@/lib/auth";
import { triggerAudit } from "@/lib/audit/triggerAudit";
import { airtableFetch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass && verifyBearer(request, adminPass)) return true;
  const session = await getSession();
  return !!session;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { client_id?: string; root_url?: string; triggered_by?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { client_id, root_url, triggered_by } = body;
  if (!client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  // Look up client name + nav pages + required config from Airtable.
  let clientName = client_id;
  let derivedRoot = root_url ?? "";
  let navUrls: string[] = [];
  let cms = "";
  let gscProperty = "";
  try {
    const records = await airtableFetch<{
      id: string;
      fields: {
        company_name?: string;
        site_url?: string;
        nav_pages?: string;
        cms?: string;
        gsc_property?: string;
      };
    }>("Clients", { filterByFormula: `RECORD_ID()="${client_id}"`, maxRecords: 1 });
    const c = records[0];
    if (!c) {
      return NextResponse.json({ error: `Client ${client_id} not found in Airtable` }, { status: 404 });
    }
    clientName = c.fields.company_name ?? clientName;
    derivedRoot = derivedRoot || (c.fields.site_url ?? "");
    cms = c.fields.cms ?? "";
    gscProperty = c.fields.gsc_property ?? "";
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
  } catch (e) {
    console.warn("[audit/start] airtable lookup failed:", e);
    return NextResponse.json({ error: "Failed to fetch client config from Airtable" }, { status: 500 });
  }

  // Pre-flight required config — fail fast at the API boundary instead of
  // letting audit_parent abort downstream after we've burned a Supabase row.
  const missing: string[] = [];
  if (!derivedRoot) missing.push("site_url (or pass root_url)");
  if (!cms) missing.push("cms");
  if (!gscProperty) missing.push("gsc_property");
  if (navUrls.length === 0) missing.push("nav_pages");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Client config incomplete — missing: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Guard against duplicate submissions for the same client. Two concurrent
  // crawls fight for the single Chromium pool on the crawler service and the
  // second one tends to OOM-kill the first. If an audit is already in flight
  // for this client, return the existing run_id with 409 so the UI can route
  // the user to the in-progress run instead of spawning a second one.
  try {
    const supabase = getSupabase();
    const { data: inflight } = await supabase
      .from("audit_runs")
      .select("id, status, created_at")
      .eq("client_id", client_id)
      .in("status", ["queued", "crawling", "diagnosing"])
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = inflight?.[0];
    const STALE_MS = 30 * 60 * 1000;
    if (existing) {
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      if (ageMs < STALE_MS) {
        return NextResponse.json(
          {
            error: "An audit is already running for this client.",
            audit_run_id: existing.id,
            status: existing.status,
          },
          { status: 409 },
        );
      }
      // Stale run — mark it failed so it doesn't linger in the UI forever,
      // then fall through to create a fresh run. Supabase builders never throw;
      // they always resolve to { data, error }, so no try/catch needed.
      await supabase
        .from("audit_runs")
        .update({ status: "failed", error_message: "Abandoned — replaced by a newer run after 30-minute stale timeout." })
        .eq("id", existing.id);
    }
  } catch (e) {
    console.warn("[audit/start] in-flight check failed (non-fatal):", e);
    // Fall through — better to allow a possibly-duplicate submit than to
    // block all submissions on a Supabase hiccup.
  }

  try {
    const validTriggers = ["admin_rerun", "scheduled", "intake"] as const;
    type Trigger = typeof validTriggers[number];
    const resolvedTrigger: Trigger =
      triggered_by && (validTriggers as readonly string[]).includes(triggered_by)
        ? (triggered_by as Trigger)
        : "admin_rerun";

    const result = await triggerAudit({
      client_id,
      client_name: clientName,
      root_url: derivedRoot,
      triggered_by: resolvedTrigger,
      nav_urls: navUrls,
      concurrency: 3,
    });
    return NextResponse.json({ ok: true, audit_run_id: result.audit_run_id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
