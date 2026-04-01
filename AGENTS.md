<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Overview

This is a Next.js 16 (App Router) SEO Dashboard for "Something Inc." with two interfaces:
- **Internal Admin Dashboard** (`/(internal)/` routes) — password-protected admin panel
- **Client Portal** (`/portal/[token]/` routes) — token-authenticated client-facing portal

The sole data backend is **Airtable** (external SaaS). There is no local database, Docker, or separate microservice.

### Required Environment Variables

Create a `.env.local` file (gitignored) with:
- `AIRTABLE_API_KEY` — Airtable personal access token
- `AIRTABLE_BASE_ID` — Airtable base ID (starts with `app`)
- `ADMIN_PASSWORD` — Password for the internal admin login

Without valid Airtable credentials, all data-fetching pages will show "Airtable 404" errors; the login page and auth flow still work.

### Running the app

- `npm run dev` — starts dev server on port 3000
- `npm run build` — production build (also validates TypeScript)
- No ESLint config or test framework is configured in this repo.

### Gotchas

- The app uses Next.js 16.2.1 with React 19 — consult `node_modules/next/dist/docs/` for API differences vs older Next.js.
- There is a `proxy.ts` middleware file at the project root that checks `ADMIN_PASSWORD` for internal routes; ensure it is set or the admin area will be inaccessible.
- No lint or test scripts exist in `package.json`; `npm run build` is the best available correctness check.
