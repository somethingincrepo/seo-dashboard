# Corrected Prompt — Connections Subsystem for SEO Audit Implementation

## Context

You wrote a prompt to Claude proposing a `connections` subsystem to replace the current "PATs pasted into Airtable" approach. After cross-referencing it against the actual dashboard + worker codebases (`~/Desktop/Claude/dashboard`, `~/Desktop/Claude/worker`), several things in the prompt don't match what we actually build for.

**What's wrong with the original prompt:**

1. **CMS list is wrong.** It includes 4 platforms we don't use (WordPress.com/Jetpack, Ghost, Contentful, Sanity) and is **missing HubSpot**, which we have full implement-SOP coverage for (`worker/sops/implement_hubspot.md`).
2. **Scope is too broad.** The proposed `publish() / update() / delete()` interface with a `ContentInput { title, slug, html, excerpt, featuredImageUrl, tags, status, publishAt }` shape describes a generic blog-post publishing layer. That isn't what this subsystem is for. Per your direction, this layer covers only audit-implementation operations: metadata, redirects, light technical fixes, content updates to existing pages, and FAQs only where the site has an existing FAQ-injection function.
3. **Ignores existing implement SOPs.** The actual writing already happens in `implement_wordpress.md`, `implement_shopify.md`, `implement_hubspot.md`, `implement_webflow.md` (worker SOPs that run as Claude tool loops). The connections subsystem should provide credential storage + decryption + capability declaration — it should not replace those SOPs.
4. **"Don't build the UI" is wrong for v1.** The original prompt punts UI to a follow-up. But how clients connect today is **WordPress-only** in the actual UI: the portal Credentials tab at `app/portal/[token]/settings/page.tsx` only renders an input form when `client.cms === 'wordpress'`. Non-WP clients see helpful per-CMS guidance text (Shopify, Webflow, HubSpot, Squarespace, Wix, Framer) **but no fields to enter credentials** — there's nowhere for them to actually connect. Same on the admin side at `app/(internal)/clients/[id]/page.tsx`. Cloudflare credentials (`cloudflare_zone`, `cloudflare_token`) are in the schema but have zero UI anywhere. Without UI work in this PR, the API is unreachable for everyone except WP clients. The corrected prompt makes the per-CMS form factory + admin parity + Cloudflare section in-scope.
5. **Missing project conventions.** The dashboard runs Next.js 16 with breaking changes from public Next docs (see `dashboard/AGENTS.md`). Auth is HMAC-cookie based, not Supabase Auth.
6. **OAuth-first is premature.** Existing integrations are PAT-style (WP application passwords, Shopify Custom App tokens, HubSpot Private App tokens, Webflow site tokens). v1 should encrypt + centralize PATs; OAuth comes per-platform later when each app is registered.

The corrected prompt is below — paste it into a new conversation as-is.

---

# CORRECTED PROMPT

Right now we store CMS credentials as plaintext fields on the Airtable `Clients` record (`wp_username`, `wp_app_password`, plus per-platform tokens that aren't even reflected in the `ClientFields` TypeScript type yet). I want to replace this with a proper connections subsystem that encrypts credentials at rest and exposes a typed capability surface that the existing implement SOPs can read from.

## Goal

Build a `connections` subsystem that:
1. Lets a Guru client connect one or more CMS sites to their account, using whichever auth flow each platform actually exposes (paste-credential for v1; OAuth deferred per platform).
2. Stores credentials encrypted at rest in Supabase.
3. Exposes a typed, **scoped** adapter interface for the operations our audit-implementation pipeline actually performs — not a generic CMS publishing API.
4. Declares per-platform capabilities so the orchestrator knows which change types are auto-executable vs. must be flagged `manual_required`.
5. Handles credential validation, expiry/revocation tracking, and connection health monitoring.

This subsystem **does not replace** the existing implement SOPs at `worker/sops/implement_*.md`. Those continue to perform the actual writes via Claude tool loops. The connections layer provides the credential-fetch + capability-check primitives those SOPs (and the dashboard test endpoints) call into.

## How clients actually connect today (the UX you're plugging into)

Clients access their portal via username/password at `/portal/login` (no invite-token redemption page exists yet — admin emails them credentials directly). Once in the portal, the **Credentials** tab at `/portal/[token]/settings` is where they connect their site. Today:

- If `client.cms === 'wordpress'`: a real form with WP username, application password, SEO plugin dropdown, page builder dropdown, and a working **Test connection** button.
- If `client.cms` is anything else (`shopify`, `webflow`, `hubspot`, `squarespace`, `wix`, `framer`, `custom`): they see a per-CMS help panel explaining how to generate a token, **but no input fields and no test button**. There is no way for a non-WP client to actually connect today.
- Admin mirror at `/clients/[id]` has the same WP-only limitation, via `components/ui/CmsCredentialsForm.tsx`.
- `cloudflare_zone` and `cloudflare_token` are in `ClientFields` and are read by the WordPress redirect implementation, but **nowhere in the UI collects them**.
- The CMS picker only exists at admin-side client creation (`/clients/new`), with options: WordPress, Shopify, Webflow, Squarespace, Wix, HubSpot, Framer, Custom.

This subsystem must close those UX gaps in the same release as the API/service layer, otherwise the API ships unreachable for every non-WP client.

## Scope of operations

The adapter interface covers **only** what our audit pipeline writes to client sites:

- **Metadata** — title and meta description on existing pages
- **Headings** — H1 updates on existing pages
- **Content updates** — edits to existing pages (NOT publishing new posts or pages)
- **Alt text** — image alt text (WordPress only, in practice)
- **Redirects** — added when an audit recommends one and the client approves it
- **FAQ injection** — only when the platform has an existing/installable function for it (WP w/ Code Snippets is the only one currently)
- **Schema injection** — same: only where a `<head>` injection function exists (WP w/ Code Snippets)
- **Noindex / unpublish** — for content pruning recommendations

Out of scope: creating new posts/pages, generic blog-publish flows, media library uploads, theme edits. (Article publishing exists separately in `publish_article_wordpress.md` and is not part of this subsystem.)

## Platforms (in priority order)

1. **WordPress (self-hosted)** — Application Passwords (already used). User pastes `site_url`, `username`, `application_password`. Validate against `{site_url}/wp-json/wp/v2/users/me`. Full capability set: metadata (Yoast/RankMath REST), H1 (Gutenberg or Elementor JSON), content updates, alt text, FAQ + schema injection (via Code Snippets plugin), noindex, redirects (via Cloudflare Workers — uses `cloudflare_zone` + `cloudflare_token`).
2. **Shopify** — Custom App access token (paste) for v1; full Shopify App OAuth deferred. User pastes `shop_domain` (e.g. `myshop.myshopify.com`) and `admin_access_token`. Validate via Admin API `/admin/api/2024-01/shop.json`. Capabilities: metadata (metafields), H1 (page title), internal-link / content updates (`body_html`), redirects (`/admin/api/redirects`), unpublish. **Not** auto-executable: FAQ, schema, alt text.
3. **HubSpot** — Private App access token (paste) for v1; OAuth deferred. User pastes `access_token`. Validate via `/account-info/v3/details`. Capabilities: metadata (`htmlTitle` / `metaDescription`), H1 (`name`), content updates (PATCH), redirects (`/url-mappings/v3`), unpublish.
4. **Webflow** — Site API token (paste) for v1; OAuth deferred. User pastes `access_token`; adapter enumerates sites via `/sites` and creates one connection per site. Capabilities on CMS items: metadata (`fieldData.seo.*`), H1 (`fieldData.name`), content updates, draft toggle. Static pages: SEO + publish only. Redirects are Enterprise-only — flag as `manual_required` for non-Enterprise.
5. **Framer** — Stub adapter. All write methods throw `NotSupportedError("Framer does not expose a public publishing API. Manual edits only.")`. Capabilities map declares everything `manual_required`. Keep the file in place.

Do **not** scaffold WordPress.com, Ghost, Contentful, or Sanity adapters. We don't have any clients on those and adding stubs is dead code.

Squarespace and Wix appear in the CMS picker today but have no implement SOPs and no public write API we use. Treat them like Framer — stub adapter, all-`manual_required` capabilities, real entry in the picker so a client can still set their CMS and see the right help panel.

### Auxiliary: Cloudflare (for redirects)

Cloudflare is not a CMS; it's an auxiliary credential the WordPress redirect path uses (`cloudflare_zone` + `cloudflare_token`). Treat it as a separate connection type with `platform: 'cloudflare'` and a capability map that only declares `redirect: true`. This keeps the abstraction clean: when an audit recommends a redirect on a WP site, the implementation reads two connections — the `wordpress_self` connection for everything else, and the `cloudflare` connection for the redirect itself. If a WP client has no Cloudflare connection, redirects flag `manual_required` for them.

Validation: `validateManualCredentials({ zone_id, api_token })` hits `https://api.cloudflare.com/client/v4/zones/{zone_id}` with the token. Token must have `Zone:Edit` scope. UI for entry lives in the same Credentials tab, in its own section below the CMS form.

## Architecture

### Project conventions (read these first)

- The dashboard runs Next.js 16. Read `node_modules/next/dist/docs/` in the dashboard repo before writing route handlers — it has breaking changes from publicly documented Next behavior. Heed deprecation notices.
- Supabase client: `lib/supabase.ts` (singleton, service-role key). The dashboard does not use Supabase Auth — auth is HMAC-cookie based via `lib/auth.ts` (admin) and `lib/portal-auth.ts` (clients). Don't introduce Supabase Auth.
- Airtable remains the source of truth for `Clients` records. The `connections` table in Supabase references `client_id` (the Airtable client slug), not a Supabase user id.
- Existing implement SOPs at `worker/sops/implement_*.md` read credentials from the Airtable Clients record today. After this subsystem ships, they should fetch from the connections service instead. Update those SOPs in the same PR (or a follow-up) — don't leave both paths live.
- Worker tools live at `worker/src/tools/` — add a `connection_get` tool that decrypts and returns credentials for a given `client_id` + `platform` so SOPs can call it.

### Database (Supabase, Postgres)

Migration in `dashboard/supabase/migrations/`:

- `connections`
  - `id` uuid pk
  - `client_id` text — matches Airtable Clients `client_id` slug (not a uuid; see existing schema)
  - `platform` text — enum: `wordpress_self | shopify | hubspot | webflow | framer`
  - `status` text — enum: `active | expired | revoked | error | manual_only`
  - `display_name` text — e.g. `myclient.myshopify.com`, `blog.acme.com`
  - `external_site_id` text — platform-specific identifier (shop domain, Webflow site id, etc.)
  - `capabilities` jsonb — per-operation booleans (`{ metadata: true, h1: true, faq: false, ... }`); set by adapter at connection time, re-checked on health check
  - `metadata` jsonb — platform-specific (shop domain, Webflow site id, WP REST base, Cloudflare zone reference if any)
  - `access_token_encrypted` bytea
  - `refresh_token_encrypted` bytea (nullable; null for paste-credential platforms)
  - `expires_at` timestamptz (nullable; null = non-expiring, which is the v1 default)
  - `last_verified_at` timestamptz
  - `last_publish_at` timestamptz (nullable)
  - `created_at`, `updated_at` timestamptz
  - Unique: `(client_id, platform, external_site_id)`

- `connection_events` (audit log)
  - `id`, `connection_id`, `event_type` (`connected | verified | published | publish_failed | revoked | health_check_failed | capabilities_changed`), `payload` jsonb, `created_at`

- `oauth_states` — only needed once any OAuth platform ships. Skip for v1 if all platforms are paste-credential at launch.

RLS: enable on all tables. Service-role only — there's no Supabase Auth user to scope to. Access control happens at the API-route layer via the existing portal/admin session helpers.

### Encryption

`libsodium-wrappers` for symmetric encryption at the app layer. Key in env var `CONNECTION_ENCRYPTION_KEY` (32 bytes, base64). Helper at `lib/connections/crypto.ts` exposes `encrypt(plaintext) / decrypt(ciphertext)`. Do not use `pgsodium` — keep tokens out of the database in plaintext form, including in logs and error messages. When logging, only emit a `tokenFingerprint` (first 4 + last 4 of decrypted token, or a sha256 prefix).

### Adapter interface

```ts
type Platform = 'wordpress_self' | 'shopify' | 'hubspot' | 'webflow' | 'framer';

type Capabilities = {
  metadata: boolean;
  h1: boolean;
  contentUpdate: boolean;
  altText: boolean;
  redirect: boolean;
  faqInjection: boolean;
  schemaInjection: boolean;
  noindex: boolean;
};

interface CMSAdapter {
  platform: Platform;

  // Credentials
  validateManualCredentials(input: Record<string, string>): Promise<{
    accessToken: string;
    externalSiteId: string;
    displayName: string;
    metadata: Record<string, unknown>;
    capabilities: Capabilities;
  }>;

  // OAuth hooks (unused for v1; defined so we can add later without changing callers)
  getAuthorizationUrl?(state: string, clientId: string): string;
  exchangeCodeForToken?(code: string, state: string): Promise<TokenResult>;
  refreshToken?(connection: Connection): Promise<TokenResult>;

  // Health
  verifyConnection(connection: Connection): Promise<HealthCheckResult>;

  // Scoped operations — only what audit implementation needs.
  // Each returns { ok, externalRef?, beforeSnapshot? } so revert_payload can be populated.
  updateMetadata(connection: Connection, externalId: string, input: { title?: string; description?: string }): Promise<OpResult>;
  updateHeading(connection: Connection, externalId: string, h1: string): Promise<OpResult>;
  updateContent(connection: Connection, externalId: string, input: { html?: string; patches?: ContentPatch[] }): Promise<OpResult>;
  updateAltText?(connection: Connection, mediaId: string, alt: string): Promise<OpResult>;
  addRedirect?(connection: Connection, input: { from: string; to: string; type?: 301 | 302 }): Promise<OpResult>;
  injectFaq?(connection: Connection, externalId: string, faqs: { q: string; a: string }[]): Promise<OpResult>;
  injectSchema?(connection: Connection, externalId: string, schema: object): Promise<OpResult>;
  setNoindex?(connection: Connection, externalId: string, noindex: boolean): Promise<OpResult>;

  // Optional: webhook handler for uninstall / revocation (Shopify primarily)
  handleWebhook?(req: Request): Promise<WebhookResult>;
}
```

Methods marked optional (`?`) are absent on adapters whose `capabilities` map declares them `false`. Calling code routes through the service layer, which checks capabilities before dispatch and returns a `ManualRequiredError` if unsupported (mapped to `execution_status: 'manual_required'` in the existing `Changes` flow).

There is **no** `publish(content)` or `delete()` method. Creating posts and deleting pages are out of scope for this subsystem.

### File structure

```
dashboard/lib/connections/
  types.ts
  crypto.ts
  registry.ts          // platform → adapter map
  service.ts           // load/decrypt, capability gate, dispatch, event logging
  adapters/
    wordpress-self.ts
    shopify.ts
    hubspot.ts
    webflow.ts
    framer.ts          // stub: throws NotSupportedError; capabilities all false
    squarespace.ts     // stub: capabilities all false
    wix.ts             // stub: capabilities all false
    cloudflare.ts      // auxiliary: only redirect capability
dashboard/app/api/connections/
  manual/route.ts                 // POST: paste-credential connect (all v1 platforms)
  [id]/route.ts                   // GET (status), DELETE (disconnect / mark revoked)
  [id]/test/route.ts              // POST: runs verifyConnection
  [platform]/authorize/route.ts   // OAuth scaffold (404s in v1; here for future)
  [platform]/callback/route.ts    // OAuth scaffold (404s in v1)
  [platform]/webhook/route.ts     // Shopify uninstall webhook handler
dashboard/components/connections/
  ConnectionForm.tsx              // form factory — switches by platform, renders right fields + test
  fields/
    WordPressFields.tsx           // username, app password, seo_plugin, page_builder
    ShopifyFields.tsx             // shop_domain, admin_access_token
    HubspotFields.tsx             // access_token
    WebflowFields.tsx             // access_token (then site picker after enumerate)
    CloudflareFields.tsx          // zone_id, api_token
    StubFields.tsx                // for framer/squarespace/wix — read-only "manual only"
  ConnectionStatusCard.tsx        // shows current status, last_verified_at, capabilities, Test/Disconnect buttons
worker/src/tools/
  connection_get.ts               // worker-side tool: fetch + decrypt creds for SOP
```

The existing `components/ui/CmsCredentialsForm.tsx` becomes a thin wrapper around `ConnectionForm` for backwards compatibility, or is replaced outright once admin and portal both move to the new form.

### Service layer

`lib/connections/service.ts` exposes:

```ts
async function connectManual(clientId: string, platform: Platform, input: Record<string, string>): Promise<Connection>;
async function listConnectionsForClient(clientId: string): Promise<Connection[]>;
async function getConnection(connectionId: string): Promise<Connection | null>;
async function disconnectConnection(connectionId: string): Promise<void>;
async function verifyConnection(connectionId: string): Promise<HealthCheckResult>;
async function dispatch<T extends keyof CMSAdapter>(connectionId: string, op: T, ...args): Promise<OpResult>;
```

`dispatch` is the single entry point implement SOPs and worker tools call. It:
1. Loads the connection, decrypts the token.
2. Checks `capabilities[op]` — if false, logs `capabilities_changed` event and returns `{ ok: false, reason: 'manual_required' }`.
3. Calls the adapter method.
4. Logs `published | publish_failed` event.
5. On 401/403: marks `status: 'expired'`, logs event, returns `{ ok: false, reason: 'expired' }`. Does not throw — callers handle the result enum.
6. Updates `last_publish_at` / `last_verified_at` as appropriate.

### Existing code to reuse / migrate

- `dashboard/lib/clients.ts` — `ClientFields` currently has `wp_username`, `wp_app_password`, `cloudflare_zone`, `cloudflare_token`. After migration, treat these as legacy: read from connections first, fall back to the Airtable fields if no connection row exists. Plan a follow-up to drop the Airtable fields once all clients are migrated.
- `dashboard/app/portal/[token]/settings/page.tsx` — the Credentials tab. Today it gates the entire form on `cms === 'wordpress'`. Replace the gated block with `<ConnectionForm platform={cms} ... />` so every CMS gets a real form. Keep the existing per-CMS help panels (WordPress, Shopify, Webflow, HubSpot, Squarespace, Wix, Framer, Custom) — they're well-written and stay as the right-rail context. Add a Cloudflare section below the CMS form for clients on platforms where redirects need it (WordPress today; others can extend later).
- `dashboard/app/(internal)/clients/[id]/page.tsx` — the admin "CMS Credentials" section is also WP-gated. Replace with the same `<ConnectionForm>` so admin can enter creds for any client's platform.
- `dashboard/components/ui/CmsCredentialsForm.tsx` — current WP-only form. Either rewrite as the new generic `ConnectionForm` factory or wrap and deprecate.
- `dashboard/app/portal/login/page.tsx` and `dashboard/app/(internal)/clients/new/page.tsx` — out of scope; don't touch login flow or admin client creation. The CMS picker on `clients/new` already drives `client.cms`, which the new form factory keys off.
- `dashboard/app/api/portal/settings/test-wp-connection/route.ts` and `dashboard/app/api/clients/[id]/test-wp-connection/route.ts` — generalize into the new `[id]/test/route.ts`. Keep the old paths as thin redirects for one release.
- `dashboard/app/api/portal/settings/cms-credentials/route.ts` and `dashboard/app/api/clients/[id]/cms-credentials/route.ts` — replace bodies with calls to `connectManual()` instead of writing Airtable fields directly.
- `dashboard/lib/changes.ts` — the existing `execution_status: 'manual_required'` value already exists; reuse it for capability mismatches.
- Worker SOPs `implement_wordpress.md`, `implement_shopify.md`, `implement_hubspot.md`, `implement_webflow.md` — replace direct credential reads with `connection_get` tool calls.

### Connection-to-client model

A client record can have multiple connections (one per platform). The CMS picker on `clients/new` sets `client.cms` to the **primary** content platform; the connections subsystem stores actual credentials separately and supports auxiliary connections (Cloudflare for redirects, possibly others later) on the same client. When the implement SOPs run, they look up the connection by `(client_id, platform)` — the primary `client.cms` controls which CMS implement SOP routes to (`implement_wordpress` vs `implement_shopify` etc.); auxiliary connections (Cloudflare) are looked up only by the SOPs that need them.

If a client changes their primary CMS later, the existing connection rows for the old platform stay (auditable history) — the picker change just reroutes new audits.

### Webhooks

Shopify sends app/uninstall webhooks; HubSpot has a deauth webhook. Webflow does not. Verify HMAC on Shopify (`X-Shopify-Hmac-Sha256`) before trusting. On uninstall: set `status: 'revoked'`, log event. Never delete the row — keep it for audit and revert_payload integrity.

### Per-platform notes

**WordPress (self-hosted):** `validateManualCredentials({ site_url, username, application_password })` hits `/wp-json/wp/v2/users/me` with Basic auth. Capabilities derive from probes: check whether Code Snippets plugin is installed (`/wp-json/code-snippets/v2/snippets`) → enables `faqInjection` + `schemaInjection`. Check whether Yoast OR RankMath is active → enables `metadata`. Check `cloudflare_zone` + `cloudflare_token` presence → enables `redirect`.

**Shopify:** `validateManualCredentials({ shop_domain, admin_access_token })` hits `/admin/api/2024-01/shop.json`. `external_site_id` is the shop domain. No FAQ/schema/altText capabilities.

**HubSpot:** `validateManualCredentials({ access_token })` hits `/account-info/v3/details`. `external_site_id` is the portal id.

**Webflow:** `validateManualCredentials({ access_token })` hits `/sites` and returns one connection per site (caller decides which to persist). Redirects only on Enterprise plans — detect and set `capabilities.redirect` accordingly.

**Framer:** stub adapter; `validateManualCredentials` always returns `{ status: 'manual_only', capabilities: {all false} }` so the row exists for orchestration purposes but every operation routes to manual.

### Environment variables

```
CONNECTION_ENCRYPTION_KEY=
APP_URL=
# OAuth client IDs/secrets are NOT needed for v1.
# Add per-platform when OAuth ships:
# SHOPIFY_CLIENT_ID=, SHOPIFY_CLIENT_SECRET=
# HUBSPOT_CLIENT_ID=, HUBSPOT_CLIENT_SECRET=
# WEBFLOW_CLIENT_ID=, WEBFLOW_CLIENT_SECRET=
```

### Testing

The dashboard uses Vitest where tests exist; check the repo's test setup before adding. For each adapter, write tests that:
- Mock platform HTTP responses with `msw`.
- Verify `validateManualCredentials` parses the response and returns the right `capabilities` map.
- Verify each scoped operation constructs the right request body and headers.
- Verify the service layer's capability gate returns `manual_required` instead of calling the adapter when a capability is false.

Skip end-to-end tests against real platforms — those need real apps registered.

### What NOT to build (yet)

- No invite-token redemption page. The DB table and validation route exist, but onboarding stays admin-driven (admin emails portal credentials). Wire it up later.
- No retry/backoff in the adapter or service layer. The worker tool loop already handles retries.
- No admin tooling for ops to inspect connections beyond what surfaces in the existing client detail page.
- No OAuth flows in v1. Scaffold the routes (return 404) so adding them later is contained.
- No new content-publish pipeline. Article publishing stays in `publish_article_wordpress.md`.
- No WordPress.com, Ghost, Contentful, or Sanity adapters. We don't have clients on those.

What **is** in scope for UI (since the existing UI is WP-only and the API alone wouldn't be reachable for non-WP clients): the `<ConnectionForm>` factory and per-platform field components, the Cloudflare credentials section, and the swap-in at the two existing locations (portal Credentials tab and admin client page). No new pages, no new navigation, no onboarding wizard.

## Deliverables

1. Supabase migration in `dashboard/supabase/migrations/`.
2. All files under `dashboard/lib/connections/` and `dashboard/app/api/connections/`.
3. UI components under `dashboard/components/connections/` — the `ConnectionForm` factory, per-platform field components, Cloudflare fields, and `ConnectionStatusCard`.
4. Edits to `dashboard/app/portal/[token]/settings/page.tsx` (Credentials tab) and `dashboard/app/(internal)/clients/[id]/page.tsx` (CMS Credentials section) to use the new form. Keep the existing per-CMS help panels in the portal Credentials tab.
5. New worker tool `worker/src/tools/connection_get.ts` and tool registration update.
6. Updates to existing SOPs (`implement_wordpress.md`, `implement_shopify.md`, `implement_hubspot.md`, `implement_webflow.md`) to fetch credentials via `connection_get` instead of the Airtable client record.
7. Update `dashboard/app/api/portal/settings/cms-credentials/route.ts`, `dashboard/app/api/clients/[id]/cms-credentials/route.ts`, and the two `test-wp-connection` routes to use the new service.
8. `.env.example` updated.
9. `lib/connections/README.md` covering: how to register apps with each platform (when OAuth ships), the v1 paste-credential flow, capability map semantics, and how to add a new platform adapter.
10. Vitest tests for each adapter and the service layer's capability gate.

## Process

1. Read `dashboard/AGENTS.md` and the relevant Next 16 docs in `node_modules/next/dist/docs/` before writing route handlers.
2. Read existing patterns: `lib/supabase.ts`, `lib/portal-auth.ts`, `lib/clients.ts`, the existing test-wp-connection routes, the current `app/portal/[token]/settings/page.tsx` Credentials tab, `components/ui/CmsCredentialsForm.tsx`, and one implement SOP (`worker/sops/implement_wordpress.md`).
3. Propose the schema + capability map + adapter interface + form factory shape in a single message and wait for approval before writing code.
4. Implement WordPress end-to-end first (API + adapter + form + admin/portal swap-in + SOP migration). This is the reference. Tests.
5. Then Cloudflare (auxiliary, simple) so redirects work end-to-end on WP.
6. Then Shopify, HubSpot, Webflow in priority order — each gets adapter + field component + test endpoint + SOP migration.
7. Framer / Squarespace / Wix stubs last.
8. README after the patterns settle.

Don't build all platforms in parallel. Ship one working flow before the next.

---

## Verification (for when implementation runs)

End-to-end check after build:
1. `vitest run lib/connections` — all adapter + service tests green.
2. As a portal user on a WP client, open `/portal/[token]/settings` Credentials tab — see the same form as before, click Test, see success.
3. As a portal user on a Shopify client, open the same tab — see Shopify fields (shop_domain + admin_access_token), paste creds, click Test, see success. (This is the previously broken path.)
4. Repeat for HubSpot and Webflow client portals.
5. As admin on `/clients/[id]` for a non-WP client, see the matching credential form (was hidden before).
6. Connect Cloudflare on a WP client (zone_id + api_token) and confirm a separate `connections` row with `platform: 'cloudflare'` and `capabilities.redirect: true`.
7. Run an audit on the WP test client; approve a metadata change; confirm the implement_wordpress SOP fetches credentials via `connection_get` (check job logs in dashboard) and writes successfully; verify `last_publish_at` updates and a `published` event lands in `connection_events`.
8. Approve a redirect on the same client; confirm the SOP fetches both the WordPress connection and the Cloudflare connection, and the redirect lands.
9. Manually rotate the WP application password to invalidate it; trigger another implement; confirm the connection flips to `status: 'expired'` and the change ends in `execution_status: 'failed'` (not stuck mid-implement).
10. Set `client.cms = 'framer'` on a test client and connect the Framer stub — confirm `capabilities` is all-false and any approved change for that client lands in `execution_status: 'manual_required'`.
11. `POST /api/connections/{id}/test` — returns `{ ok: true, capabilities }` for each connected platform.

## Critical files

- `dashboard/lib/clients.ts` — `ClientFields` (legacy credential fields)
- `dashboard/lib/supabase.ts` — service-role client
- `dashboard/lib/portal-auth.ts`, `dashboard/lib/auth.ts` — session helpers
- `dashboard/app/portal/[token]/settings/page.tsx` — Credentials tab (currently WP-only; swap in `<ConnectionForm>`)
- `dashboard/app/(internal)/clients/[id]/page.tsx` — admin CMS Credentials section (same swap)
- `dashboard/components/ui/CmsCredentialsForm.tsx` — current WP-only form to deprecate
- `dashboard/app/api/portal/settings/cms-credentials/route.ts`, `dashboard/app/api/clients/[id]/cms-credentials/route.ts` — replace Airtable write
- `dashboard/app/api/portal/settings/test-wp-connection/route.ts`, `dashboard/app/api/clients/[id]/test-wp-connection/route.ts` — generalize
- `dashboard/lib/changes.ts` — existing `manual_required` execution_status
- `dashboard/supabase/migrations/` — add new migration
- `worker/sops/implement_wordpress.md`, `implement_shopify.md`, `implement_hubspot.md`, `implement_webflow.md` — switch to `connection_get`
- `worker/src/tools/` — add `connection_get`
- `dashboard/AGENTS.md` — Next.js conventions warning
