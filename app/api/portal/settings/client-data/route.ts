import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const f = client.fields;
  return NextResponse.json({
    cms: f.cms || "",
    site_url: f.site_url || "",
    wp_username: f.wp_username || "",
    wp_app_password: f.wp_app_password || "",
    seo_plugin: f.seo_plugin || "",
    page_builder: f.page_builder || "",
    gsc_property: f.gsc_property || "",
  });
}
