import {
  Capabilities,
  DecryptedConnection,
  EMPTY_CAPABILITIES,
  HealthCheckResult,
  ValidateResult,
} from "../types";

const CF_API = "https://api.cloudflare.com/client/v4";

export const cloudflare = {
  platform: "cloudflare" as const,

  async validateManualCredentials(input: Record<string, string>): Promise<ValidateResult> {
    const zoneId = String(input.zone_id || "").trim();
    const token = String(input.api_token || "").trim();
    if (!zoneId) throw new Error("zone_id is required");
    if (!token) throw new Error("api_token is required");

    const r = await fetch(`${CF_API}/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (r.status === 401 || r.status === 403) {
      throw new Error("Cloudflare rejected the token. Confirm the token has Zone:Edit scope on this zone.");
    }
    if (!r.ok) {
      throw new Error(`Cloudflare API returned ${r.status}. Check the zone ID.`);
    }

    const body = (await r.json()) as { success: boolean; result?: { name?: string; id?: string } };
    if (!body.success || !body.result) {
      throw new Error("Cloudflare API returned an unexpected response.");
    }

    const capabilities: Capabilities = { ...EMPTY_CAPABILITIES, redirect: true };

    return {
      accessToken: token,
      externalSiteId: zoneId,
      displayName: body.result.name || zoneId,
      metadata: { zone_id: zoneId, zone_name: body.result.name || null },
      capabilities,
    };
  },

  async verifyConnection(connection: DecryptedConnection): Promise<HealthCheckResult> {
    const zoneId = String(connection.metadata.zone_id || connection.external_site_id || "");
    if (!zoneId) return { ok: false, reason: "unknown", error: "Missing zone_id" };
    try {
      const r = await fetch(`${CF_API}/zones/${zoneId}`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, reason: "unauthorized", error: "Token rejected" };
      }
      if (!r.ok) return { ok: false, reason: "unknown", error: `HTTP ${r.status}` };
      return { ok: true, capabilities: { ...EMPTY_CAPABILITIES, redirect: true } };
    } catch (e) {
      return { ok: false, reason: "network", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
