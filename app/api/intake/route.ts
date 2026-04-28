import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { airtableCreate, airtableFetch } from "@/lib/airtable";
import { hashPassword } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";
import { triggerAudit } from "@/lib/audit/triggerAudit";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function deriveDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
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
    billing_email,
    site_url,
    cms,
    additional_sites,
    keywords,
    competitors,
    pivot_context,
    excluded_pages,
    seo_plugin,
    page_builder,
    brand_voice_links,
    claims_no_generate,
    content_approver,
    brand_guidelines_url,
    logo_url,
    customer_questions,
    sales_questions,
    in_slack,
    report_day,
    approval_turnaround,
    invite_token,
  } = body as Record<string, unknown>;

  // Required field validation
  if (!company_name || typeof company_name !== "string" || !company_name.trim()) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }
  if (!contact_name || typeof contact_name !== "string" || !contact_name.trim()) {
    return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
  }
  if (!contact_email || typeof contact_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
  }
  if (!site_url || typeof site_url !== "string" || !site_url.trim()) {
    return NextResponse.json({ error: "Primary website URL is required." }, { status: 400 });
  }
  if (!cms || typeof cms !== "string" || !cms.trim()) {
    return NextResponse.json({ error: "CMS is required." }, { status: 400 });
  }
  if (!keywords || typeof keywords !== "string" || !keywords.trim()) {
    return NextResponse.json({ error: "Target keywords are required." }, { status: 400 });
  }
  if (!competitors || typeof competitors !== "string" || !competitors.trim()) {
    return NextResponse.json({ error: "At least one competitor is required." }, { status: 400 });
  }
  if (!invite_token || typeof invite_token !== "string" || !invite_token.trim()) {
    return NextResponse.json({ error: "An invite token is required." }, { status: 400 });
  }

  // Validate the invite token and resolve the package tier
  const tokenStr = (invite_token as string).trim().toUpperCase();
  const supabase = getSupabase();
  const { data: tokenRow, error: tokenLookupError } = await supabase
    .from("invite_tokens")
    .select("id, package_tier, used_at, expires_at")
    .eq("token", tokenStr)
    .single();

  if (tokenLookupError || !tokenRow) {
    return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: "This invite token has already been used." }, { status: 400 });
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite token has expired. Please contact us for a new one." }, { status: 400 });
  }
  const packageTier = tokenRow.package_tier as string;

  const normalizedUrl = normalizeUrl(site_url as string);
  const client_id = slugify(company_name as string);
  const domain = deriveDomain(normalizedUrl);
  const gsc_property = domain ? `sc-domain:${domain}` : "";
  // Seed nav_pages with the homepage — audit_parent requires this to be non-empty
  const nav_pages = JSON.stringify([normalizedUrl]);

  // Idempotency — reject duplicate site URLs
  try {
    const existing = await airtableFetch<{ id: string }>("Clients", {
      filterByFormula: `{site_url} = "${normalizedUrl.replace(/\/$/, "")}"`,
      maxRecords: 1,
    });
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A client with this website URL already exists. Please contact us if this is unexpected." },
        { status: 409 }
      );
    }
  } catch {
    // Non-fatal — proceed if check fails
  }

  // Generate portal credentials up-front so the client can log in once onboarding is complete
  const portal_token = crypto.randomUUID();
  const portal_username = client_id;
  const portal_password = randomBytes(12).toString("base64url");
  const portal_password_hash = await hashPassword(portal_password);

  // Build the Airtable fields — all derived fields included from the start
  const fields: Record<string, unknown> = {
    company_name: (company_name as string).trim(),
    contact_name: (contact_name as string).trim(),
    contact_email: (contact_email as string).trim().toLowerCase(),
    site_url: normalizedUrl,
    domain,
    gsc_property,
    nav_pages,
    cms: (cms as string).trim(),
    keywords: (keywords as string).trim(),
    competitors: (competitors as string).trim(),
    client_id,
    plan_status: "month1_audit",
    month_number: 0,
    package: packageTier ? String(packageTier) : "growth",
    portal_token,
    portal_username,
    portal_password,
    portal_password_hash,
  };

  // Optional text / long-text fields
  const textFields: [string, unknown][] = [
    ["billing_email", billing_email],
    ["additional_sites", additional_sites],
    ["pivot_context", pivot_context],
    ["excluded_pages", excluded_pages],
    ["brand_voice_links", brand_voice_links],
    ["claims_no_generate", claims_no_generate],
    ["content_approver", content_approver],
    ["brand_guidelines_url", brand_guidelines_url],
    ["logo_url", logo_url],
    ["customer_questions", customer_questions],
    ["sales_questions", sales_questions],
  ];
  for (const [key, val] of textFields) {
    if (val && String(val).trim()) fields[key] = String(val).trim();
  }

  // Optional single-select fields — only write when a real option is chosen
  if (seo_plugin && String(seo_plugin) !== "") fields.seo_plugin = String(seo_plugin);
  if (page_builder && String(page_builder) !== "") fields.page_builder = String(page_builder);
  if (report_day && String(report_day) !== "") fields.report_day = String(report_day);
  if (approval_turnaround && String(approval_turnaround) !== "") fields.approval_turnaround = String(approval_turnaround);

  // Checkbox
  if (in_slack === true || in_slack === "true") fields.in_slack = true;

  let record: { id: string };
  try {
    record = await airtableCreate("Clients", fields);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Submission failed: ${msg}` }, { status: 500 });
  }

  // Mark the invite token as used — non-blocking, failure doesn't surface to the client
  try {
    await supabase
      .from("invite_tokens")
      .update({ used_at: new Date().toISOString(), used_by_client_id: record.id })
      .eq("token", tokenStr);
  } catch (e) {
    console.error("[intake] failed to mark invite token as used:", e);
  }

  // Fire the deterministic audit engine. Non-blocking: failure logs but doesn't surface to the client.
  // The crawler webhook returns 202 quickly; the actual crawl + diagnose runs in the background on Fly.
  try {
    await triggerAudit({
      client_id: record.id,
      client_name: (company_name as string).trim(),
      root_url: normalizedUrl,
      triggered_by: "intake",
      nav_urls: [normalizedUrl],
    });
  } catch (e) {
    console.error(`[intake] audit trigger failed for ${record.id}:`, e);
  }

  return NextResponse.json({ ok: true, record_id: record.id, client_id }, { status: 201 });
}
