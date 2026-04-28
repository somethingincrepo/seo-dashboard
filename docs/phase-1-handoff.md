# Phase 1 Audit Engine — Handoff

Date: 2026-04-28

## What was built

- **Supabase schema.** New migration [`20260428_create_audit_engine.sql`](../supabase/migrations/20260428_create_audit_engine.sql) creates `audit_runs`, `pages`, and `issues` tables. The schema is wider than the original brief because the rule scope was expanded from 10 to 75 rules covering all four categories.
- **Rules engine.** 75 deterministic rules under [`lib/audit/rules/`](../lib/audit/rules/), one file per rule, registered in [`index.ts`](../lib/audit/rules/index.ts). Categories: 22 technical, 22 on-page, 18 content, 13 ai-geo. 67 page-scope, 8 site-scope.
- **Vitest fixtures.** 152 tests (one passing + one failing fixture per rule, plus registry assertions). All passing.
- **Fly crawler service.** New separate package at [`services/crawler/`](../../services/crawler/). Crawlee + Playwright + Cheerio + fast-xml-parser. Includes Dockerfile + fly.toml. Authenticated via shared bearer token.
- **Audit API routes.** [`/api/audit/start`](../app/api/audit/start/route.ts) (admin/intake-callable), [`/api/audit/diagnose`](../app/api/audit/diagnose/route.ts) (called by crawler with shared token), [`/api/audit/issues`](../app/api/audit/issues/route.ts) (admin, used by repeatability panel).
- **Intake rewired.** [`app/api/intake/route.ts`](../app/api/intake/route.ts) no longer enqueues `audit_parent`. It now calls `triggerAudit()` directly, which inserts the run row and fires the crawler webhook.
- **Portal page.** New tab "Site Audit" in the portal sidebar. [`/portal/[token]/audit`](../app/portal/[token]/audit/page.tsx) renders a master-detail UI matching the existing Approvals page aesthetic. Empty/in-progress/failed states handled.
- **Admin pages.** [`/audit`](../app/(internal)/audit/page.tsx) lists all runs across clients, [`/audit/[id]`](../app/(internal)/audit/[id]/page.tsx) shows the detail page with stats, severity/category bars, full issue list, and the Phase 1 acceptance gate (repeatability panel).

## What was deferred

- **Agentic "why this matters" enrichment.** Phase 2. Each rule ships with a static `description` field that's used in the meantime.
- **Generation of fix copy.** Phase 4. The detail panel shows a "Generation coming soon" placeholder where `proposed_value` will eventually render.
- **Rules requiring keyword intent.** Skipped — these need the per-page primary keyword mapping and pair naturally with the generation agent.
- **Crawler concurrency tuning + retry policy.** Defaults are 5 concurrency, 5000 max pages, 30s page timeout. Will need tuning for very large sites (>5k pages) or sites with aggressive rate limiting.
- **GitHub deploy hooks for the crawler.** Manual `fly deploy` from the `services/crawler/` dir for now.

## Decisions worth flagging

- **Scope of the rewrite.** Original brief was shadow-mode (run new + old audits in parallel). Per direction, we instead **replaced** the trigger entirely. The old `worker/sops/audit_*` SOPs are untouched but no longer fire on new client intake. Existing in-flight `audit_parent` jobs for previously-onboarded clients will run to completion.
- **Page-level vs site-level rules.** `issues.page_id` is **nullable** to support site-scope rules ("robots.txt missing"). Filter on `scope = 'site'` to find them.
- **Schema parsing.** Rules check what JSON-LD types are *actually present* on each page, not what we expect. The crawler parses every `<script type="application/ld+json">` block, collects `@type` values into `schema_types`, and stashes raw blocks in `schema_blocks` for rules that need to inspect fields like `author`, `aggregateRating`, etc.
- **No agentic calls in the rules engine.** Hard rule. Every rule is a pure function. If a future check needs LLM judgment ("is this title compelling?"), it goes to Phase 2 enrichment, not the rules engine.

## Setup required before first run

1. Apply the migration in Supabase SQL editor (path inside the file).
2. Generate `CRAWLER_SERVICE_TOKEN`: `openssl rand -hex 32`. Set it in dashboard env (Vercel) and as a Fly secret on the crawler.
3. Deploy the crawler: `cd services/crawler && fly launch` (first time) or `fly deploy`. Set Fly secrets:
   ```
   fly secrets set \
     SUPABASE_URL=... \
     SUPABASE_SERVICE_ROLE_KEY=... \
     CRAWLER_SERVICE_TOKEN=... \
     VERCEL_BASE_URL=https://your-dashboard.vercel.app
   ```
4. Set `CRAWLER_SERVICE_URL` and `CRAWLER_SERVICE_TOKEN` on the dashboard (Vercel env).
5. Verify `GET https://<crawler-app>.fly.dev/health` returns `{ "ok": true, ... }`.
6. Run the repeatability test on a small site to gate Phase 1 acceptance.

## Verification status

- ✅ TypeScript typechecks across the dashboard.
- ✅ All 152 vitest tests pass.
- ⏳ Crawler service hasn't been deployed yet — Dockerfile + fly.toml are written, but the actual `fly deploy` will need to happen with the secrets above set.
- ⏳ End-to-end audit run hasn't been executed (depends on Fly deploy).
- ⏳ Repeatability gate hasn't been validated against a real site (depends on E2E run).

## Files added

```
dashboard/
  supabase/migrations/20260428_create_audit_engine.sql
  lib/audit/
    rules/
      types.ts
      index.ts
      R001 … R075-*.ts            (75 rule files)
      __tests__/
        fixtures.ts
        rules.test.ts
    queries.ts
    triggerAudit.ts
  app/api/audit/
    start/route.ts
    diagnose/route.ts
    issues/route.ts
  app/portal/[token]/audit/page.tsx
  app/(internal)/audit/
    page.tsx
    [id]/page.tsx
  components/portal/
    AuditMasterDetail.tsx
    AuditEmptyState.tsx
  components/admin/
    AuditRepeatabilityPanel.tsx
  vitest.config.ts
  .env.example
  docs/
    audit-engine.md
    phase-1-handoff.md

  services/crawler/                  (new package, deployed separately to Fly)
    package.json
    tsconfig.json
    Dockerfile
    fly.toml
    .env.example
    .dockerignore
    src/
      index.ts
      crawler.ts
      extractor.ts
      site-checks.ts
      post-crawl.ts
      supabase.ts
      url.ts
```

## Files modified

```
dashboard/package.json                          (+ vitest dev dep, + test scripts)
dashboard/app/api/intake/route.ts               (replaced audit_parent enqueue with triggerAudit)
dashboard/app/portal/[token]/layout.tsx         (fetch + plumb auditIssueCount)
dashboard/components/portal/PortalSidebar.tsx   (add Site Audit nav item + IconAudit + badge)
dashboard/components/layout/Sidebar.tsx         (add Audits link to admin sidebar)
```
