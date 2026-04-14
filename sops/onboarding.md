# Client Onboarding SOP

This document covers the full onboarding sequence for a new client — from account creation through portal access. It is a human-facing process document, not an agent SOP.

---

## Step 1 — Create the Client Record

Go to `/clients/new` in the admin dashboard and fill in:

- **Company Name** — used to auto-generate the client slug (e.g. `acme-corp`)
- **Contact Name / Email** — who receives communications
- **Site URL** — full URL including `https://`; domain and GSC property auto-derive from this
- **CMS** — WordPress, Shopify, Webflow, etc.
- **GSC Property** — auto-filled as `sc-domain:example.com`; adjust if needed
- **Nav Pages** — one URL per line; the core pages used by all audit SOPs
- **Seed Keywords** — comma-separated starting keywords for research
- **Competitors** — comma-separated competitor domains
- **Trigger Month 1 audit** — check this to kick off the audit immediately

Hit **Create Client**. This calls `POST /api/clients/create` and:

1. Creates the Airtable record
2. Auto-generates portal credentials (username, password, token)
3. Optionally queues the `audit_parent` job on Fly.io

---

## Step 2 — Retrieve and Send Portal Credentials

The success screen immediately shows:

| Field | Value | Source |
|---|---|---|
| Username | `acme-corp` (client slug) | Auto-generated |
| Password | `Abc123XyzQrst` (random 16 chars) | Auto-generated |
| Login URL | `https://yourdomain.com/portal/login` | Fixed |

**Copy these and send them to the client.** This is the only time the plaintext password appears on the creation screen. If you miss it, it is always retrievable from the client detail page (`/clients/[id]`) under "Portal Login Credentials".

These three values are also written to Airtable:
- `portal_username` — the username
- `portal_password` — the plaintext password (admin reference only)
- `portal_password_hash` — the hashed version used for login verification

---

## Step 3 — What to Send the Client

Send the client an email or message with:

```
Here's how to access your SEO dashboard:

Login URL: https://yourdomain.com/portal/login
Username:  acme-corp
Password:  Abc123XyzQrst
```

They can also still access via the direct portal link (`/portal/[token]`) if you prefer to share that instead — both methods work simultaneously.

---

## Step 4 — Monitor the Audit (if triggered)

If "Trigger Month 1 audit" was checked, an `audit_parent` job was created. Monitor it at `/jobs/[job_id]` or the `/jobs` list. The audit:

1. Crawls the site and identifies SEO issues
2. Writes changes to Airtable (`Changes` table)
3. Sets `plan_status` to `awaiting_approval` when complete
4. Changes appear in the client's portal under Approvals

---

## Step 5 — After the Audit

Once the audit completes:

1. Review the pending changes in the client's portal (`/portal/[token]/approvals`)
2. Run SOP 14 (keyword research) when ready
3. Run SOP 15 (title generation) after SOP 14 completes
4. Monthly reports run automatically via `report_generate` SOP

---

## Credential Management

**Where credentials live:**
- Airtable `Clients` table: `portal_username`, `portal_password`, `portal_password_hash`
- Admin dashboard: client detail page → "Portal Login Credentials" card
- One-time display on the new client success screen

**To regenerate credentials** (e.g. client forgets password):
- Go to `/clients/[id]`
- Click "Regenerate Credentials" under "Portal Login Credentials"
- New username + password displayed immediately
- Airtable is updated automatically
- Old password immediately stops working

**To regenerate just the portal link token:**
- Click "Regenerate" under "Client Portal" on the same page
- Old URL immediately stops working

---

## What Goes Where

| Data | Stored In | Visible To |
|---|---|---|
| `portal_username` | Airtable | Admin (dashboard + Airtable) |
| `portal_password` | Airtable (plaintext) | Admin (dashboard + Airtable) |
| `portal_password_hash` | Airtable | Never shown (used for login only) |
| `portal_token` | Airtable | Admin (used to build portal URL) |
| Session cookie | Client's browser | Client only (7-day expiry) |
