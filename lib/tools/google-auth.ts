import { createSign } from "crypto";

const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/**
 * Get a short-lived Google access token.
 *
 * Service account (preferred): set GOOGLE_SERVICE_ACCOUNT_JSON to the full
 * service account key JSON. The tokenKey is used as the OAuth scope string
 * (e.g. "https://www.googleapis.com/auth/webmasters.readonly"), or pass
 * "indexing" to use the Indexing API scope.
 *
 * OAuth2 fallback: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * GOOGLE_REFRESH_TOKEN (and optionally GOOGLE_INDEXING_REFRESH_TOKEN).
 * Pass "indexing" as tokenKey to use the indexing-scoped refresh token.
 */
export async function getGoogleAccessToken(tokenKey?: string): Promise<string> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const scope = tokenKey === "indexing"
      ? INDEXING_SCOPE
      : tokenKey?.startsWith("https://")
      ? tokenKey
      : DEFAULT_SCOPE;
    return getServiceAccountToken(scope);
  }
  return getOAuthToken(tokenKey);
}

// ─── Service Account JWT flow ─────────────────────────────────────────────────

async function getServiceAccountToken(scope: string): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  let key: { client_email: string; private_key: string; token_uri?: string };
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenUri = key.token_uri || "https://oauth2.googleapis.com/token";

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope,
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const unsigned = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Service account token error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ─── OAuth2 refresh token flow (fallback) ────────────────────────────────────

async function getOAuthToken(tokenKey?: string): Promise<string> {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh_token =
    tokenKey === "indexing"
      ? (process.env.GOOGLE_INDEXING_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN)
      : process.env.GOOGLE_REFRESH_TOKEN;

  if (!client_id || !client_secret || !refresh_token) {
    throw new Error(
      "Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON, or set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN."
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id,
      client_secret,
      refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token as string;
}
