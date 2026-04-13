import { NextRequest, NextResponse } from "next/server";
import { airtableCreate } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    company_name,
    contact_name,
    contact_email,
    site_url,
    domain,
    cms,
    gsc_property,
    nav_pages,
    keywords,
    competitors,
    notes,
    run_audit = false,
  } = body as Record<string, unknown>;

  if (!company_name || !site_url || !domain || !cms) {
    return NextResponse.json(
      { error: "company_name, site_url, domain, and cms are required" },
      { status: 400 }
    );
  }

  const client_id = slugify(company_name as string);

  // Build nav_pages JSON — accept array or JSON string
  let navPagesJson = "[]";
  if (Array.isArray(nav_pages)) {
    navPagesJson = JSON.stringify(nav_pages);
  } else if (typeof nav_pages === "string" && nav_pages.trim()) {
    try {
      JSON.parse(nav_pages); // validate it's JSON
      navPagesJson = nav_pages;
    } catch {
      // Treat as newline-separated URLs
      const urls = (nav_pages as string)
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      navPagesJson = JSON.stringify(urls);
    }
  }

  // Create client record in Airtable
  const fields: Record<string, unknown> = {
    company_name,
    contact_name: contact_name || "",
    contact_email: contact_email || "",
    site_url,
    domain,
    cms,
    gsc_property: gsc_property || `sc-domain:${domain}`,
    nav_pages: navPagesJson,
    keywords: keywords || "",
    competitors: competitors || "",
    notes: notes || "",
    client_id,
    status: "form_submitted",
    plan_status: "form_submitted",
  };

  let record: { id: string };
  try {
    record = await airtableCreate("Clients", fields);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Airtable create failed: ${msg}` }, { status: 500 });
  }

  // Optionally trigger the audit
  let jobId: string | null = null;
  if (run_audit) {
    // Validate gsc_property is set (audit requires it)
    if (!gsc_property && !domain) {
      return NextResponse.json(
        { ok: true, record_id: record.id, client_id, warning: "Client created but audit not triggered — gsc_property is required" },
        { status: 201 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        sop_name: "audit_parent",
        client_id: record.id,
        payload: { client_id: record.id },
        status: "pending",
        runner: "fly",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: true, record_id: record.id, client_id, warning: `Client created but job insert failed: ${error.message}` },
        { status: 201 }
      );
    }

    jobId = (data as { id: string }).id;
  }

  return NextResponse.json(
    { ok: true, record_id: record.id, client_id, job_id: jobId },
    { status: 201 }
  );
}
