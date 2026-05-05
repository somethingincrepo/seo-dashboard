import {
  Capabilities,
  DecryptedConnection,
  EMPTY_CAPABILITIES,
  HealthCheckResult,
  Platform,
  ValidateResult,
} from "../types";

// Stub adapter for platforms that have no public publishing API we use:
// framer, squarespace, wix. Stores a marker connection so the UI can show
// "manual only" and the orchestrator can route changes to manual_required.
export function createManualOnlyAdapter(platform: Platform) {
  return {
    platform,

    async validateManualCredentials(input: Record<string, string>): Promise<ValidateResult> {
      const siteUrl = String(input.site_url || "").trim();
      if (!siteUrl) throw new Error("site_url is required");
      const capabilities: Capabilities = { ...EMPTY_CAPABILITIES };
      return {
        accessToken: "manual-only",
        externalSiteId: siteUrl,
        displayName: siteUrl,
        metadata: { site_url: siteUrl, manual_only: true },
        capabilities,
      };
    },

    async verifyConnection(_connection: DecryptedConnection): Promise<HealthCheckResult> {
      return { ok: true, capabilities: { ...EMPTY_CAPABILITIES } };
    },
  };
}

export const framer = createManualOnlyAdapter("framer");
export const squarespace = createManualOnlyAdapter("squarespace");
export const wix = createManualOnlyAdapter("wix");
