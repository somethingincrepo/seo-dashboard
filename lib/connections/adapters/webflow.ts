import {
  Capabilities,
  DecryptedConnection,
  EMPTY_CAPABILITIES,
  HealthCheckResult,
  ValidateResult,
} from "../types";

// v2 OAuth scopes
const SCOPES = ["sites:read", "cms:read", "cms:write", "pages:read", "pages:write"];

function appUrl(): string {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (!u) throw new Error("APP_URL is not set");
  return u.replace(/\/+$/, "");
}

function clientCreds(): { id: string; secret: string } {
  const id = process.env.WEBFLOW_CLIENT_ID || "";
  const secret = process.env.WEBFLOW_CLIENT_SECRET || "";
  if (!id || !secret) {
    throw new Error("WEBFLOW_CLIENT_ID and WEBFLOW_CLIENT_SECRET are not set");
  }
  return { id, secret };
}

export const webflow = {
  platform: "webflow" as const,

  getAuthorizationUrl(state: string): string {
    const { id } = clientCreds();
    const redirect = `${appUrl()}/api/connections/webflow/callback`;
    const params = new URLSearchParams({
      client_id: id,
      response_type: "code",
      redirect_uri: redirect,
      scope: SCOPES.join(" "),
      state,
    });
    return `https://webflow.com/oauth/authorize?${params.toString()}`;
  },

  async exchangeCodeForToken(params: { code: string }): Promise<ValidateResult> {
    const { id, secret } = clientCreds();
    const redirect = `${appUrl()}/api/connections/webflow/callback`;

    const body = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: redirect,
    });
    const r = await fetch("https://api.webflow.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Webflow token exchange failed: HTTP ${r.status}`);
    const tok = (await r.json()) as { access_token?: string };
    if (!tok.access_token) throw new Error("Webflow did not return an access_token");

    // Enumerate sites — we attach to the first one for v1, store all.
    const sr = await fetch("https://api.webflow.com/v2/sites", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!sr.ok) throw new Error(`Webflow /v2/sites returned ${sr.status}`);
    const sites = (await sr.json()) as { sites?: Array<{ id: string; displayName?: string; shortName?: string }> };
    const list = sites.sites ?? [];
    const first = list[0];

    const capabilities: Capabilities = {
      ...EMPTY_CAPABILITIES,
      metadata: true,
      h1: true,
      contentUpdate: true,
      noindex: true,
      // Redirects exist only on Enterprise plans — leave off; flag manual_required at dispatch time.
    };

    return {
      accessToken: tok.access_token,
      externalSiteId: first?.id || "",
      displayName: first ? first.displayName || first.shortName || first.id : "Webflow",
      metadata: {
        sites: list.map((s) => ({ id: s.id, name: s.displayName || s.shortName || s.id })),
        scope: SCOPES.join(" "),
      },
      capabilities,
    };
  },

  async verifyConnection(connection: DecryptedConnection): Promise<HealthCheckResult> {
    try {
      const r = await fetch("https://api.webflow.com/v2/sites", {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, reason: "unauthorized", error: "Webflow token rejected" };
      }
      if (!r.ok) return { ok: false, reason: "unknown", error: `HTTP ${r.status}` };
      const capabilities: Capabilities = {
        ...EMPTY_CAPABILITIES,
        metadata: true,
        h1: true,
        contentUpdate: true,
        noindex: true,
      };
      return { ok: true, capabilities };
    } catch (e) {
      return { ok: false, reason: "network", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
