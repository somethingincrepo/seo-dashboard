import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { airtableCreate, airtableFetch } from "@/lib/airtable";
import { hashPassword } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.ADMIN_PASSWORD}`) return true;
  const session = await getSession();
  return !!session;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
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
    package: packageTier,
    run_audit = false,
  } = body as Record<string, unknown>;

  if (!company_name || !site_url || !domain || !cms) {
    return NextResponse.json(
      { error: "company_name, site_url, domain, and cms are required" },
      { status: 400 }
    );
  }

  const VALID_PACKAGES = ["starter", "growth", "authority"];
  if (!packageTier || !VALID_PACKAGES.includes(packageTier as string)) {
    return NextResponse.json(
      { error: "package must be one of: starter, growth, authority" },
      { status: 400 }
    );
  }

  if (!/^https?:\/\/\S+/.test(site_url as string)) {
    return NextResponse.json(
      { error: "site_url must be a valid URL starting with http:// or https://" },
      { status: 400 }
    );
  }

  const client_id = slugify(company_name as string);

  // Idempotency check — reject if a client with the same site_url already exists
  try {
    const existing = await airtableFetch<{ id: string; fields: { site_url?: string } }>(
      "Clients",
      { filterByFormula: `{site_url} = "${(site_url as string).replace(/\/$/, "")}"`, maxRecords: 1 }
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `A client with site_url "${site_url}" already exists (record: ${existing[0].id}). Delete it first or use the existing record.` },
        { status: 409 }
      );
    }
  } catch {
    // Non-fatal — proceed if check fails
  }

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

  // Auto-generate portal token + credentials at creation
  const portal_token = crypto.randomUUID();
  const portal_username = client_id;
  const portal_password = randomBytes(12).toString("base64url");
  const portal_password_hash = await hashPassword(portal_password);

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
    package: packageTier,
    plan_status: run_audit ? "month1_audit" : "form_submitted",
    portal_token,
    portal_username,
    portal_password_hash,
    portal_password, // plaintext — stored for admin reference
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
    {
      ok: true,
      record_id: record.id,
      client_id,
      job_id: jobId,
      portal_username,
      portal_password,
      portal_token,
    },
    { status: 201 }
  );
}
