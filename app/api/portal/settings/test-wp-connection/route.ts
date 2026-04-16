import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";

export async function POST(_request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await getClientByToken(session.portal_token);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { site_url, wp_username, wp_app_password, cms } = client.fields;

  if (!site_url) return NextResponse.json({ ok: false, error: "No site URL on file — contact support" });
  if (!wp_username) return NextResponse.json({ ok: false, error: "WP username not set — save credentials first" });
  if (!wp_app_password) return NextResponse.json({ ok: false, error: "WP app password not set — save credentials first" });
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
        error: "Auth failed — check your username and application password. Make sure you're using a WordPress Application Password, not your login password.",
      });
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `WordPress REST API returned ${res.status}. Check that the REST API is enabled on your site.`,
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
    return NextResponse.json({ ok: false, error: `Connection failed: ${msg}` });
  }
}
