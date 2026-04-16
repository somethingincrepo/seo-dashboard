/**
 * Get a short-lived Google OAuth2 access token using the refresh token flow.
 * Requires three env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN          — used for GSC and general Google APIs
 *   GOOGLE_INDEXING_REFRESH_TOKEN — optional; used for the Indexing API (needs
 *                                   https://www.googleapis.com/auth/indexing scope)
 *                                   Falls back to GOOGLE_REFRESH_TOKEN if not set.
 *
 * Pass `"indexing"` as the tokenKey to use the indexing-scoped refresh token.
 */
export async function getGoogleAccessToken(tokenKey?: string): Promise<string> {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh_token =
    tokenKey === "indexing"
      ? (process.env.GOOGLE_INDEXING_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN)
      : process.env.GOOGLE_REFRESH_TOKEN;

  if (!client_id || !client_secret || !refresh_token) {
    throw new Error(
      "Google OAuth credentials not configured. Need: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
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
