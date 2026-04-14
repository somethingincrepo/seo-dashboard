import { NextRequest, NextResponse } from "next/server";
import { airtableFetch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

type ClientRecord = {
  id: string;
  fields: {
    site_url?: string;
    wp_username?: string;
    wp_app_password?: string;
    cms?: string;
  };
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const records = await airtableFetch<ClientRecord>("Clients", {
    filterByFormula: `RECORD_ID()="${id}"`,
    fields: ["site_url", "wp_username", "wp_app_password", "cms"],
    maxRecords: 1,
  });

  const client = records[0];
  if (!client) {
    return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });
  }

  const { site_url, wp_username, wp_app_password, cms } = client.fields;

  if (!site_url) return NextResponse.json({ ok: false, error: "No site_url on client record" });
  if (!wp_username) return NextResponse.json({ ok: false, error: "wp_username not set — save credentials first" });
  if (!wp_app_password) return NextResponse.json({ ok: false, error: "wp_app_password not set — save credentials first" });
  if (cms?.toLowerCase() !== "wordpress") {
    return NextResponse.json({ ok: false, error: `CMS is "${cms}", not WordPress` });
  }

  const base = site_url.replace(/\/$/, "");
  const token = Buffer.from(`${wp_username}:${wp_app_password}`).toString("base64");

  try {
    const res = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        error: `Auth failed (${res.status}) — check wp_username and wp_app_password. Make sure it's an Application Password, not your regular WP login password.`,
      });
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `WP REST API returned ${res.status}. Check that the REST API is enabled on this site.`,
      });
    }

    const data = await res.json() as { name?: string; slug?: string; roles?: string[] };
    return NextResponse.json({
      ok: true,
      wp_user: data.name || data.slug || wp_username,
      roles: data.roles ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Request failed: ${msg}` });
  }
}
