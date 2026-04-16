import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

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
  });
}
