import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/connections/auth-guard";
import { isOauthPlatform } from "@/lib/connections/registry";
import { createOauthState } from "@/lib/connections/service";
import { shopify } from "@/lib/connections/adapters/shopify";
import { hubspot } from "@/lib/connections/adapters/hubspot";
import { webflow } from "@/lib/connections/adapters/webflow";
import type { Platform } from "@/lib/connections/types";

// Initiates OAuth. The browser navigates to this route with the user's portal
// session cookie attached; we generate state, persist it, then 302-redirect to
// the platform's authorize URL. The state survives the round-trip via the
// oauth_states table.
//
// For Shopify, the shop_domain is required as a query string parameter
// (e.g. /api/connections/shopify/authorize?shop_domain=acme.myshopify.com)
// because Shopify's authorize URL is shop-specific.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(request.url);

  if (!isOauthPlatform(platform as Platform)) {
    return NextResponse.json({ error: `${platform} is not an OAuth platform` }, { status: 400 });
  }

  const requestedClientId = url.searchParams.get("client_id") || undefined;
  const auth = await resolveAuth(requestedClientId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const redirectAfter = url.searchParams.get("redirect_after") || undefined;

  let state: string;
  try {
    state = await createOauthState({
      clientId: auth.clientId,
      platform: platform as Platform,
      redirectAfter,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Failed to create OAuth state: ${msg}` }, { status: 500 });
  }

  let authorizeUrl: string;
  try {
    if (platform === "shopify") {
      const shopDomain = url.searchParams.get("shop_domain");
      if (!shopDomain) {
        return NextResponse.json({ error: "shop_domain query param is required for Shopify" }, { status: 400 });
      }
      authorizeUrl = shopify.getAuthorizationUrl(state, { shop_domain: shopDomain });
    } else if (platform === "hubspot") {
      authorizeUrl = hubspot.getAuthorizationUrl(state);
    } else if (platform === "webflow") {
      authorizeUrl = webflow.getAuthorizationUrl(state);
    } else {
      return NextResponse.json({ error: `Unhandled OAuth platform: ${platform}` }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `OAuth not configured: ${msg}. Set the platform's CLIENT_ID and CLIENT_SECRET env vars.` },
      { status: 500 }
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
