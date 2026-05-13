import { NextRequest, NextResponse } from "next/server";
import { connectManual } from "@/lib/connections/service";
import { resolveAuth } from "@/lib/connections/auth-guard";
import type { Platform } from "@/lib/connections/types";
import { getAdapter, isOauthPlatform } from "@/lib/connections/registry";

const MANUAL_PLATFORMS: Platform[] = [
  "wordpress_self",
  "cloudflare",
  "framer",
  "squarespace",
  "wix",
];

export async function POST(request: NextRequest) {
  let body: {
    client_id?: string;
    platform?: Platform;
    credentials?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await resolveAuth(body.client_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!body.platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  if (isOauthPlatform(body.platform)) {
    return NextResponse.json(
      { error: `${body.platform} uses OAuth — start the flow via /api/connections/${body.platform}/authorize` },
      { status: 400 }
    );
  }

  if (!MANUAL_PLATFORMS.includes(body.platform)) {
    return NextResponse.json({ error: `Unsupported platform: ${body.platform}` }, { status: 400 });
  }

  // Confirm adapter exists and supports manual creds.
  const adapter = getAdapter(body.platform);
  if (!adapter.validateManualCredentials) {
    return NextResponse.json(
      { error: `${body.platform} does not support paste-credential connection` },
      { status: 400 }
    );
  }

  try {
    const conn = await connectManual(auth.clientId, body.platform, body.credentials ?? {});
    return NextResponse.json({ ok: true, connection: conn });
  } catch (e) {
    console.error("[connections/manual]", e);
    return NextResponse.json({ ok: false, error: "Failed to connect. Check credentials and try again." }, { status: 400 });
  }
}
