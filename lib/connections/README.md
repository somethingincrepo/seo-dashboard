# Connections subsystem

Encrypted, per-client CMS credentials stored in Supabase. Replaces the old "PATs pasted into Airtable" pattern.

## Supported platforms

| Platform | Auth method | Status |
|---|---|---|
| `wordpress_self` | Application Password (paste) | Full implementation |
| `cloudflare` | Scoped API token (paste) | Full implementation — auxiliary, drives redirects |
| `shopify` | OAuth 2.0 | Scaffolded — needs app registration |
| `hubspot` | OAuth 2.0 | Scaffolded — needs app registration |
| `webflow` | OAuth 2.0 | Scaffolded — needs app registration |
| `framer` / `squarespace` / `wix` | Stub | All capabilities `false` — implementation routes to `manual_required` |

## Required env vars

```
CONNECTION_ENCRYPTION_KEY=  # base64-encoded 32 bytes (openssl rand -base64 32)
APP_URL=                    # e.g. https://seo-dashboard-teal-phi.vercel.app
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
WEBFLOW_CLIENT_ID=
WEBFLOW_CLIENT_SECRET=
```

## Database

Migration: `supabase/migrations/20260505_create_connections.sql`. Apply via Supabase SQL Editor before going live.

Tables:
- `connections` — one row per (client, platform[, external_site_id]). Tokens encrypted at rest.
- `connection_events` — audit log (connected, verified, published, revoked, etc.).
- `oauth_states` — short-TTL CSRF tokens for OAuth handshake.

All tables: RLS enabled, service-role only. Access control happens at the API-route layer via `lib/connections/auth-guard.ts`.

## Architecture

```
lib/connections/
  types.ts             — shared types + Capabilities map
  crypto.ts            — AES-256-GCM encrypt/decrypt (Node built-in)
  registry.ts          — platform → adapter map; platformFromCmsField()
  service.ts           — connectManual, list, verify, OAuth state helpers
  auth-guard.ts        — resolveAuth() handles admin + portal sessions
  adapters/
    wordpress-self.ts  — Application Passwords + Code Snippets capability probe
    cloudflare.ts      — API token validation
    shopify.ts         — OAuth + token exchange
    hubspot.ts         — OAuth + token exchange + refresh
    webflow.ts         — OAuth + sites enumeration
    manual-only.ts     — framer/squarespace/wix stubs
```

API routes:

```
POST   /api/connections/manual                          — paste-credential connect
GET    /api/connections/list                            — list for client
GET    /api/connections/[id]                            — fetch single
DELETE /api/connections/[id]                            — disconnect (mark revoked)
POST   /api/connections/[id]/test                       — verifyConnection
GET    /api/connections/[platform]/authorize            — start OAuth (302 redirect)
GET    /api/connections/[platform]/callback             — finish OAuth
POST   /api/connections/shopify/webhook                 — Shopify uninstall webhook
```

UI:

- `components/connections/ConnectionForm.tsx` — single form factory; switches by platform.
- Used in: `app/portal/[token]/settings/page.tsx` (Credentials tab) and `app/(internal)/clients/[id]/page.tsx`.

## OAuth flow

1. Client clicks "Connect Shopify with OAuth" in Credentials tab.
2. Browser navigates to `/api/connections/shopify/authorize?shop_domain=...&redirect_after=...`. Route validates session, generates a CSRF state, persists in `oauth_states`, then 302s to Shopify's authorize URL.
3. Shopify prompts the merchant to install the app, then redirects to `/api/connections/shopify/callback?code=...&state=...&shop=...`.
4. Callback route verifies state, exchanges code for token via Shopify Admin API, encrypts the token, upserts into `connections`, logs a `connected` event, and 302s back to the original page with `?connected=shopify` appended.
5. The Credentials tab refreshes; `<ConnectionForm>` shows the connected state with capabilities.

## Adding a new platform

1. Add the platform name to the `Platform` type in `types.ts` and to the migration's `platform_check` constraint.
2. Create `adapters/<platform>.ts` with `validateManualCredentials` (paste-credential) or `getAuthorizationUrl` + `exchangeCodeForToken` (OAuth) plus `verifyConnection`.
3. Register in `registry.ts`. If OAuth, return `true` from `isOauthPlatform()`.
4. Add a field component branch in `ConnectionForm.tsx`.
5. Map the picker value in `platformFromCmsField()`.
6. Update `.env.example` with any required env vars.

## Migrating from Airtable credential fields

`ClientFields.wp_username`, `wp_app_password`, `cloudflare_zone`, `cloudflare_token` are legacy. Going forward, `connections` is authoritative. Implement SOPs (`worker/sops/implement_*.md`) read credentials via the worker `connection_get` tool (TODO — coming next).
