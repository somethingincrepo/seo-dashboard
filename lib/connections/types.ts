export type Platform =
  | "wordpress_self"
  | "shopify"
  | "hubspot"
  | "webflow"
  | "cloudflare"
  | "framer"
  | "squarespace"
  | "wix";

export type ConnectionStatus =
  | "active"
  | "expired"
  | "revoked"
  | "error"
  | "manual_only"
  | "pending_oauth";

export type Capabilities = {
  metadata: boolean;
  h1: boolean;
  contentUpdate: boolean;
  altText: boolean;
  redirect: boolean;
  faqInjection: boolean;
  schemaInjection: boolean;
  noindex: boolean;
};

export const EMPTY_CAPABILITIES: Capabilities = {
  metadata: false,
  h1: false,
  contentUpdate: false,
  altText: false,
  redirect: false,
  faqInjection: false,
  schemaInjection: false,
  noindex: false,
};

export type Connection = {
  id: string;
  client_id: string;
  platform: Platform;
  status: ConnectionStatus;
  display_name: string | null;
  external_site_id: string | null;
  capabilities: Capabilities;
  metadata: Record<string, unknown>;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  last_verified_at: string | null;
  last_publish_at: string | null;
  created_at: string;
  updated_at: string;
};

// Decrypted view used internally by the service layer + adapters.
export type DecryptedConnection = Omit<
  Connection,
  "access_token_encrypted" | "refresh_token_encrypted"
> & {
  accessToken: string;
  refreshToken: string | null;
};

export type ValidateResult = {
  accessToken: string;
  refreshToken?: string | null;
  externalSiteId: string;
  displayName: string;
  metadata: Record<string, unknown>;
  capabilities: Capabilities;
  expiresAt?: string | null;
};

export type HealthCheckResult =
  | { ok: true; capabilities: Capabilities; displayName?: string }
  | { ok: false; reason: "unauthorized" | "network" | "unsupported" | "unknown"; error: string };

export type OpResult =
  | { ok: true; externalRef?: string; beforeSnapshot?: Record<string, unknown> }
  | { ok: false; reason: "manual_required" | "expired" | "platform_error" | "not_implemented"; error: string };

export type ConnectionPublic = Omit<
  Connection,
  "access_token_encrypted" | "refresh_token_encrypted"
> & {
  has_token: boolean;
};

export class NotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotSupportedError";
  }
}

export class ManualRequiredError extends Error {
  constructor(public readonly platform: Platform, public readonly operation: string) {
    super(`Operation ${operation} requires manual intervention on ${platform}.`);
    this.name = "ManualRequiredError";
  }
}
