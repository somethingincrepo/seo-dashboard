/**
 * Get a short-lived Google OAuth2 access token using the refresh token flow.
 * Requires three env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 *
 * The `scope` parameter is not used in the refresh token flow (scopes were
 * fixed at the time the refresh token was granted), but is kept in the
 * signature so callers don't need to change if auth is ever swapped.
 */
export async function getGoogleAccessToken(_scope?: string): Promise<string> {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh_token = process.env.GOOGLE_REFRESH_TOKEN;

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
