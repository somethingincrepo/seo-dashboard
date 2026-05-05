import { wordpressSelf } from "./adapters/wordpress-self";
import { cloudflare } from "./adapters/cloudflare";
import { shopify } from "./adapters/shopify";
import { hubspot } from "./adapters/hubspot";
import { webflow } from "./adapters/webflow";
import { framer, squarespace, wix } from "./adapters/manual-only";
import type {
  DecryptedConnection,
  HealthCheckResult,
  Platform,
  ValidateResult,
} from "./types";

export type Adapter = {
  platform: Platform;
  validateManualCredentials?: (input: Record<string, string>) => Promise<ValidateResult>;
  // OAuth-only: getAuthorizationUrl and exchangeCodeForToken signatures vary slightly per platform.
  // We don't enforce a uniform signature here — the API routes call the specific platform adapter directly.
  verifyConnection: (connection: DecryptedConnection) => Promise<HealthCheckResult>;
  refreshToken?: (connection: DecryptedConnection) => Promise<ValidateResult>;
};

export const REGISTRY: Record<Platform, Adapter> = {
  wordpress_self: wordpressSelf,
  cloudflare,
  shopify,
  hubspot,
  webflow,
  framer,
  squarespace,
  wix,
};

export function getAdapter(platform: Platform): Adapter {
  const a = REGISTRY[platform];
  if (!a) throw new Error(`Unknown platform: ${platform}`);
  return a;
}

// Indicates whether a platform uses OAuth (vs paste-credential) in v1.
// Drives whether the UI shows a "Connect with X" button or a credentials form.
export function isOauthPlatform(platform: Platform): boolean {
  return platform === "shopify" || platform === "hubspot" || platform === "webflow";
}

// Indicates whether the platform is a manual-only stub.
export function isManualOnly(platform: Platform): boolean {
  return platform === "framer" || platform === "squarespace" || platform === "wix";
}

// Maps the Airtable Clients.cms picker value → connection platform.
// Picker uses display values; connections use the snake_case enum.
export function platformFromCmsField(cms: string | undefined | null): Platform | null {
  if (!cms) return null;
  const k = cms.toLowerCase().replace(/\s+/g, "");
  if (k === "wordpress") return "wordpress_self";
  if (k === "shopify") return "shopify";
  if (k === "hubspot" || k === "hubspotcms") return "hubspot";
  if (k === "webflow") return "webflow";
  if (k === "framer") return "framer";
  if (k === "squarespace") return "squarespace";
  if (k === "wix") return "wix";
  return null;
}
