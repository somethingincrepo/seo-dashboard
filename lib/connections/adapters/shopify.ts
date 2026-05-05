import {
  Capabilities,
  DecryptedConnection,
  EMPTY_CAPABILITIES,
  HealthCheckResult,
  ValidateResult,
} from "../types";

const SCOPES = ["write_content", "read_content", "write_redirects", "read_redirects", "write_themes", "read_themes"];

function appUrl(): string {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (!u) throw new Error("APP_URL is not set");
  return u.replace(/\/+$/, "");
}

function clientCreds(): { id: string; secret: string } {
  const id = process.env.SHOPIFY_CLIENT_ID || "";
  const secret = process.env.SHOPIFY_CLIENT_SECRET || "";
  if (!id || !secret) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are not set");
  }
  return { id, secret };
}

function shopFromInput(raw: string): string {
  const cleaned = raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(cleaned)) {
    throw new Error("Shop must look like 'yourshop.myshopify.com'");
  }
  return cleaned.toLowerCase();
}

export const shopify = {
  platform: "shopify" as const,

  // OAuth start: redirect URL for Shopify's authorize page.
  // The caller passes the shop domain via `shop_domain` in the start route's body.
  getAuthorizationUrl(state: string, opts: { shop_domain: string }): string {
    const { id } = clientCreds();
    const shop = shopFromInput(opts.shop_domain);
    const redirect = `${appUrl()}/api/connections/shopify/callback`;
    const params = new URLSearchParams({
      client_id: id,
      scope: SCOPES.join(","),
      redirect_uri: redirect,
      state,
      "grant_options[]": "",
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  },

  async exchangeCodeForToken(params: {
    code: string;
    shop: string;
  }): Promise<ValidateResult> {
    const { id, secret } = clientCreds();
    const shop = shopFromInput(params.shop);

    const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: id, client_secret: secret, code: params.code }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      throw new Error(`Shopify token exchange failed: HTTP ${r.status}`);
    }
    const tok = (await r.json()) as { access_token?: string; scope?: string };
    if (!tok.access_token) throw new Error("Shopify did not return an access_token");

    // Confirm + fetch shop info.
    const sr = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": tok.access_token },
      signal: AbortSignal.timeout(10000),
    });
    if (!sr.ok) throw new Error(`Shopify /shop.json returned ${sr.status}`);
    const shopBody = (await sr.json()) as { shop?: { id?: number; name?: string; myshopify_domain?: string } };

    const capabilities: Capabilities = {
      ...EMPTY_CAPABILITIES,
      metadata: true,
      h1: true,
      contentUpdate: true,
      redirect: true,
      noindex: true,
    };

    return {
      accessToken: tok.access_token,
      externalSiteId: shop,
      displayName: shopBody.shop?.name || shop,
      metadata: {
        shop_domain: shop,
        shop_id: shopBody.shop?.id ?? null,
        scope: tok.scope || SCOPES.join(","),
      },
      capabilities,
    };
  },

  // Shopify Admin API tokens are non-expiring offline tokens — no refresh.
  async verifyConnection(connection: DecryptedConnection): Promise<HealthCheckResult> {
    const shop = String(connection.metadata.shop_domain || connection.external_site_id || "");
    if (!shop) return { ok: false, reason: "unknown", error: "Missing shop_domain" };
    try {
      const r = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
        headers: { "X-Shopify-Access-Token": connection.accessToken },
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, reason: "unauthorized", error: "Shopify token rejected" };
      }
      if (!r.ok) return { ok: false, reason: "unknown", error: `HTTP ${r.status}` };
      const capabilities: Capabilities = {
        ...EMPTY_CAPABILITIES,
        metadata: true,
        h1: true,
        contentUpdate: true,
        redirect: true,
        noindex: true,
      };
      return { ok: true, capabilities };
    } catch (e) {
      return { ok: false, reason: "network", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
