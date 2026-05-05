import {
  Capabilities,
  DecryptedConnection,
  EMPTY_CAPABILITIES,
  HealthCheckResult,
  ValidateResult,
} from "../types";

const SCOPES = ["content", "forms", "oauth"];

function appUrl(): string {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (!u) throw new Error("APP_URL is not set");
  return u.replace(/\/+$/, "");
}

function clientCreds(): { id: string; secret: string } {
  const id = process.env.HUBSPOT_CLIENT_ID || "";
  const secret = process.env.HUBSPOT_CLIENT_SECRET || "";
  if (!id || !secret) {
    throw new Error("HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET are not set");
  }
  return { id, secret };
}

export const hubspot = {
  platform: "hubspot" as const,

  getAuthorizationUrl(state: string): string {
    const { id } = clientCreds();
    const redirect = `${appUrl()}/api/connections/hubspot/callback`;
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: redirect,
      scope: SCOPES.join(" "),
      state,
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  },

  async exchangeCodeForToken(params: { code: string }): Promise<ValidateResult> {
    const { id, secret } = clientCreds();
    const redirect = `${appUrl()}/api/connections/hubspot/callback`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: id,
      client_secret: secret,
      redirect_uri: redirect,
      code: params.code,
    });

    const r = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      throw new Error(`HubSpot token exchange failed: HTTP ${r.status}`);
    }
    const tok = (await r.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tok.access_token) throw new Error("HubSpot did not return an access_token");

    const expiresAt = tok.expires_in
      ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
      : null;

    // Fetch portal id + display name via account-info.
    const ar = await fetch("https://api.hubapi.com/account-info/v3/details", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    let portalId: number | null = null;
    let portalName = "";
    if (ar.ok) {
      const a = (await ar.json()) as { portalId?: number; uiDomain?: string; companyName?: string };
      portalId = a.portalId ?? null;
      portalName = a.companyName || a.uiDomain || (portalId ? `Portal ${portalId}` : "");
    }

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
      refreshToken: tok.refresh_token ?? null,
      externalSiteId: portalId ? String(portalId) : "",
      displayName: portalName || (portalId ? `HubSpot ${portalId}` : "HubSpot"),
      metadata: { portal_id: portalId, scope: SCOPES.join(" ") },
      capabilities,
      expiresAt,
    };
  },

  async refreshToken(connection: DecryptedConnection): Promise<ValidateResult> {
    if (!connection.refreshToken) throw new Error("HubSpot connection has no refresh token");
    const { id, secret } = clientCreds();
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: id,
      client_secret: secret,
      refresh_token: connection.refreshToken,
    });
    const r = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`HubSpot refresh failed: HTTP ${r.status}`);
    const tok = (await r.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tok.access_token) throw new Error("HubSpot refresh returned no access_token");

    return {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? connection.refreshToken,
      externalSiteId: connection.external_site_id || "",
      displayName: connection.display_name || "HubSpot",
      metadata: connection.metadata,
      capabilities: connection.capabilities,
      expiresAt: tok.expires_in
        ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
        : null,
    };
  },

  async verifyConnection(connection: DecryptedConnection): Promise<HealthCheckResult> {
    try {
      const r = await fetch("https://api.hubapi.com/account-info/v3/details", {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, reason: "unauthorized", error: "HubSpot token rejected" };
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
