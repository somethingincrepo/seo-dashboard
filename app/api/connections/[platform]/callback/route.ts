import { NextRequest, NextResponse } from "next/server";
import { consumeOauthState, upsertConnectionFromValidation } from "@/lib/connections/service";
import { isOauthPlatform } from "@/lib/connections/registry";
import { shopify } from "@/lib/connections/adapters/shopify";
import { hubspot } from "@/lib/connections/adapters/hubspot";
import { webflow } from "@/lib/connections/adapters/webflow";
import type { Platform, ValidateResult } from "@/lib/connections/types";

function fallbackRedirect(): string {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "/";
  return `${base.replace(/\/+$/, "")}/`;
}

function errorRedirect(redirectBase: string, message: string): NextResponse {
  const u = new URL(redirectBase, "http://x");
  u.searchParams.set("connection_error", message);
  return NextResponse.redirect(redirectBase.startsWith("http") ? u.toString() : `${redirectBase}?connection_error=${encodeURIComponent(message)}`);
}

function successRedirect(redirectBase: string, platform: string): NextResponse {
  const sep = redirectBase.includes("?") ? "&" : "?";
  const target = `${redirectBase}${sep}connected=${platform}`;
  return NextResponse.redirect(target);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(request.url);

  if (!isOauthPlatform(platform as Platform)) {
    return NextResponse.json({ error: `${platform} is not an OAuth platform` }, { status: 400 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return errorRedirect(fallbackRedirect(), `${platform}: ${errorParam}`);
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const stateRow = await consumeOauthState(state);
  if (!stateRow) {
    return NextResponse.json({ error: "Invalid or expired state" }, { status: 400 });
  }
  if (stateRow.platform !== platform) {
    return NextResponse.json({ error: "State/platform mismatch" }, { status: 400 });
  }

  const redirectAfter = stateRow.redirect_after || fallbackRedirect();

  let validation: ValidateResult;
  try {
    if (platform === "shopify") {
      const shop = url.searchParams.get("shop");
      if (!shop) return errorRedirect(redirectAfter, "Shopify callback missing shop parameter");
      validation = await shopify.exchangeCodeForToken({ code, shop });
    } else if (platform === "hubspot") {
      validation = await hubspot.exchangeCodeForToken({ code });
    } else if (platform === "webflow") {
      validation = await webflow.exchangeCodeForToken({ code });
    } else {
      return errorRedirect(redirectAfter, `Unhandled OAuth platform: ${platform}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorRedirect(redirectAfter, `OAuth exchange failed: ${msg}`);
  }

  try {
    await upsertConnectionFromValidation({
      clientId: stateRow.client_id,
      platform: platform as Platform,
      validation,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorRedirect(redirectAfter, `Failed to save connection: ${msg}`);
  }

  return successRedirect(redirectAfter, platform);
}
