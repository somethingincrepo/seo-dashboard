# SEO Dashboard System — Architecture

> **Read this first.** When working on the SEO automation system, this is the canonical map. If something here is wrong, fix this file in the same PR as the code change.

## Two repos, three runtimes

| Concern | Repo | Runtime | Deploy |
|---|---|---|---|
| Admin UI + client portal | `seo-dashboard` (this repo) | Vercel (Next.js 16, App Router) | `git push origin main` → auto-deploy |
| SOP runner | `seo-worker` | Fly.io (Node 20, long-running) | `git push` then `fly deploy` from `worker/` |
| State (jobs, logs, reports) | — | Supabase (Postgres) | — |
| State (clients, changes, content) | — | Airtable (two bases: main + content) | — |

**Retired (do not deploy):** `github.com/somethingincrepo/official` — the old VPS `sessions_spawn` orchestrator, archived 2026-04-28 at tag `archive/pre-consolidation-2026-04-28` and branch `archive/vps-orchestrator`. The architecture spec lives at `memory/master-document-v2.md` on that branch for historical reference.

---

## Data flow (happy path)

```
Intake form ──► dashboard /api/intake ──► Airtable Clients (plan_status=form_submitted)
                                                  │
                                                  ▼
                                  worker intakePoll (every 10 min)
                                                  │
                                                  ▼
                                       audit_parent SOP
                                                  │
                                ┌─────────────────┼──────────────────┐
                                ▼                 ▼                  ▼
                         audit_inventory  audit_gsc_overlay   (Phase 2 dimensions:
                                                              metadata, headings, schema,
                                                              faq, content, technical,
                                                              geo, keywords — fan_out
                                                              all 8 in parallel)
                                                  │
                                                  ▼
                                         consolidation
                                                  │
                                                  ▼
                                Phase 5: keyword_research ──► title_generation
                                                  │
                                                  ▼
                                Phase 5.5: seed Content Jobs (refresh)
                                                  │
                                                  ▼
                                  Phase 6: audit_internal_links
                                                  │
                                                  ▼
                            audit complete; client portal reflects findings
```

After audit:
- Client approves changes in portal → dashboard `/api/...` queues `implement` jobs
- Worker `schedulerTick` (daily) → `content_scheduler` → fans out `title_generation` for clients due new titles
- Worker `refreshSchedulerTick` (daily) → `refresh_scheduler` → fans out `content_refresh`
- Worker `publisherTick` (daily) → `publish_article_wordpress` for articles whose `scheduled_publish_date == today`
- Worker `reportSchedulerTick` (daily) → `report_generate` for clients on their `report_day`

---

## SOP catalog

Every SOP is a markdown file in `worker/sops/`. The worker loads it by exact filename when a Supabase `jobs.sop_name` matches. Frontmatter sets model, tools, max_iterations, max_tokens, timeout_ms, max_cost_usd.

| SOP | Triggered by | Notes |
|---|---|---|
| `audit_parent` | dashboard `/api/intake`, worker `intakePoll` | Coordinator. Phases 1–6, fan_out + wait_for_jobs. |
| `audit_inventory` | `audit_parent` Phase 1 | Crawl + sitemap + GSC URL discovery. Writes Pages records. |
| `audit_gsc_overlay` | `audit_parent` Phase 1 | Attaches GSC traffic data to Pages. |
| `audit_metadata` | `audit_parent` Phase 2 fan_out | Title tags, meta descriptions. |
| `audit_headings` | `audit_parent` Phase 2 fan_out | H1 uniqueness, structure. |
| `audit_schema` | `audit_parent` Phase 2 fan_out | JSON-LD structured data. |
| `audit_faq` | `audit_parent` Phase 2 fan_out | FAQ pages + schema. |
| `audit_content` | `audit_parent` Phase 2 fan_out | Content quality, pruning. |
| `audit_technical` | `audit_parent` Phase 2 fan_out | Canonicals, robots.txt, redirects. Excludes system files (llms.txt, sitemaps). |
| `audit_geo` | `audit_parent` Phase 2 fan_out | Geographic + AI visibility. |
| `audit_keywords` | `audit_parent` Phase 2 fan_out | GSC + DataForSEO keyword mapping. |
| `audit_internal_links` | `audit_parent` Phase 6 + worker `monthlyChangesSchedulerTick` | Internal link opportunities. |
| `keyword_research` | `audit_parent` Phase 5 | Generates `keyword_groups` JSON on Clients record. (Renamed from `sop14_keyword_research` 2026-04-28.) |
| `title_generation` | `audit_parent` Phase 5 + `content_scheduler` (daily) | Creates Content Jobs with proposed titles. (Renamed from `sop15_title_generation` 2026-04-28.) |
| `content_scheduler` | worker `schedulerTick` (daily) | Decides which clients need titles, fans out `title_generation`. |
| `refresh_scheduler` | worker `refreshSchedulerTick` (monthly run, daily tick) | Selects pages to refresh, creates Content Jobs, fans out `content_refresh`. |
| `content_refresh` | dashboard `/api/portal/titles` (user request), `refresh_scheduler`, `audit_parent` Phase 5.5 | Rewrites existing content. |
| `publish_article_wordpress` | worker `publisherTick` (daily) | Publishes articles with `scheduled_publish_date == today` and `portal_approval == approved`. |
| `monthly_onpage` | worker `monthlyChangesSchedulerTick` (weekly) | Pre-quota'd on-page metadata changes. |
| `implement` | dashboard approval flow | CMS dispatcher; routes to platform-specific child via fan_out. |
| `implement_wordpress` | `implement` fan_out | Yoast REST + Elementor + Code Snippets. |
| `implement_shopify` | `implement` fan_out | Shopify Admin API. |
| `implement_webflow` | `implement` fan_out | Webflow CMS API. |
| `implement_hubspot` | `implement` fan_out | HubSpot CMS API. |
| `report_generate` | worker `reportSchedulerTick` (daily, fires on client `report_day`) | Aggregates GSC/GA4/changes/content into the monthly report. |
| `rollback` | dashboard `/api/rollback` (admin clicks revert) | Reverts an implemented change using stored `revert_payload`. |

**Examples / not in registry:** `worker/sops/_examples/hello_world.md` — smoke-test SOP, lives in a subdirectory so the worker's `loadSop()` cannot reach it via normal `sop_name`.

---

## Worker scheduler ticks

All ticks live in [worker/src/index.ts](https://github.com/somethingincrepo/seo-worker/blob/main/src/index.ts). Each is idempotency-guarded so duplicate firings are safe.

| Tick | Function | Interval | Purpose | Idempotency |
|---|---|---|---|---|
| Job poll | `poll` | 30s (`POLL_INTERVAL_MS`) | Claim pending Supabase jobs, run them in semaphore (max 8 concurrent) | Atomic claim via `status='pending'` filter |
| Intake poll | `intakePoll` | 10 min (`INTAKE_POLL_INTERVAL_MS`) | Find new `plan_status=form_submitted` clients, queue `audit_parent` | Checks for existing audit_parent job per client |
| Content scheduler | `schedulerTick` | 24h (`SCHEDULER_INTERVAL_MS`) | Run `content_scheduler` SOP | "Already queued this week" check via week-start in Supabase |
| Refresh scheduler | `refreshSchedulerTick` | 24h | Run `refresh_scheduler` SOP | Same week-start check |
| Publisher | `publisherTick` | 24h | Find Results with `scheduled_publish_date == today`, queue `publish_article_wordpress` | Per-result job dedup |
| Monthly activator | `monthlyActivatorTick` | 24h | Move clients from `month1_implementing` → `active` once Month 1 done | One-shot per client |
| Report scheduler | `reportSchedulerTick` | 24h | For each active client, fire `report_generate` if today matches `report_day` | One-job-per-client-per-month |
| Month advance | `monthAdvanceTick` | 24h | Increment `month_number` for all active clients on day 1 | Supabase marker job |
| Monthly changes | `monthlyChangesSchedulerTick` | 24h (effectively weekly via marker) | Compute remaining quota, fan out `monthly_onpage` + `audit_internal_links` | Supabase marker job |

If `AIRTABLE_API_KEY` or `AIRTABLE_BASE_ID` is missing, every Airtable-touching tick logs `[<tick>] AIRTABLE_API_KEY or AIRTABLE_BASE_ID missing — skipping` instead of returning silently.

---

## Airtable schema (key fields)

**Main base — Clients table:**
- `client_id` (formula → record ID), `company_name`, `domain`, `site_url`
- `plan_status` (form_submitted | onboarding | month1_audit | awaiting_approval | month1_implementing | active | paused | offboarded | churned)
- `package` (starter | growth | authority — case may vary; SOPs lowercase before lookup)
- `portal_token`, `portal_username`, `portal_password_hash`
- `wp_username`, `wp_app_password`, `cms`, `page_builder`
- `gsc_property`, `ga4_property`, `engain_project_id`
- `keyword_groups` (JSON; written by `keyword_research`)
- `custom_keyword_groups` (JSON; client-added; never overwritten)
- `nav_pages`, `excluded_pages`, `claims_no_generate`, `pivot_context`, `competitors`
- `month_number`, `report_day`
- `inventory_total_urls`, `inventory_sitemap_urls`, `inventory_404_count`, `inventory_completed_at`
- **`audit_scope_tier`** (Single Select: `full` | `priority` | `top_traffic`) — *required for tiered audit behavior; if absent, `audit_parent` defaults to `"full"`*

**Main base — Changes table:**
- `client_id`, `audit_run_id`, `type` (Metadata | Headings | Schema | FAQ | Content | Technical | GEO | Keyword | InternalLink), `cat`
- `approval` (pending | approved | skipped | question), `implementation_tier` (Critical | High | Medium | Low)
- `page_url`, `change_title`, `current_value`, `proposed_value`, `verified_value`
- `confidence` (High | Medium | Low), `gsc_clicks_90d`, `indexing_status`
- `revert_payload` (JSON for `rollback` SOP)

**Main base — Pages table:**
- `audit_run_id`, `url`, `http_status`, `canonical`, `redirect_target`
- `meta_title`, `meta_description`, `h1_text`, `page_type`, `seo_plugin`, `page_builder`
- `is_nav_page`, `in_excluded_pages`, `in_sitemap`
- `gsc_clicks_90d`, `gsc_impressions_90d`, `gsc_avg_position_90d`

**Content base — Content Jobs table:** `client_id` (linked), `title_status` (pending | proposed | titled | next_month | approved), `proposed_at`, `target_keyword`, `desired_length_range`, `refresh_url`, `page_type`, `scheduled_for_month`

**Content base — Results table:** linked to Content Jobs; `scheduled_publish_date`, `portal_approval`, generated content blob

---

## Supabase tables

- `jobs` — `id`, `sop_name`, `client_id`, `status` (pending | claimed | running | done | failed), `runner` (vercel | fly), `payload`, `result`, `error`, `input_tokens`, `output_tokens`, `cost_usd`, `model`, `parent_job_id`, `worker_leased_until`, `created_at`, `started_at`, `finished_at`
- `job_logs` — `id`, `job_id`, `level` (info | warn | error | debug), `message`, `created_at`
- `reports` — monthly client reports (GSC/GA4/changes/content/AI-GEO/narrative)
- `gsc_snapshots` — weekly GSC trend data
- `admin_users` — `username`, `password_hash`, `role` (admin | viewer), `assigned_client_ids`, `logged_out_at`
- `invite_tokens` — onboarding tokens

---

## Deployment

| Repo | Trigger | What happens |
|---|---|---|
| `seo-dashboard` | `git push origin main` | Vercel auto-deploys. Always push after dashboard changes — Vercel won't update otherwise. |
| `seo-worker` | `git push origin main` then `fly deploy` (from `worker/`) | Builds container with current `sops/` directory, rolling-updates 2 machines on Fly.io. |

Fly CLI lives at `~/.fly/bin/fly` if `fly` isn't on PATH.

---

## Smoke tests

**Worker boot:** `fly logs --no-tail` should show `[worker] starting — poll every 30s, max concurrent: 8` within seconds of redeploy.

**Audit pipeline:** Insert a test Client in Airtable with `plan_status=form_submitted`, wait up to 10 minutes (intakePoll cycle), then watch `jobs` in Supabase: `audit_parent` → `audit_inventory` → `audit_gsc_overlay` → 8 dimension SOPs → `keyword_research` → `title_generation` → content_refresh seeding.

**One-off SOP test:** Insert a row directly:
```sql
INSERT INTO jobs (sop_name, client_id, status, runner, payload, created_at)
VALUES ('keyword_research', '<airtable_record_id>', 'pending', 'fly', '{"client_id":"<id>"}', now());
```

---

## Known fragilities

- **SOP-level silent skips.** SOPs return structured JSON like `{"status":"bottlenecked","reason":"..."}` when they decide not to act. These are visible in `jobs.result` but not surfaced in any UI yet. To debug "deliverables didn't fire," query `SELECT result FROM jobs WHERE sop_name='content_scheduler' ORDER BY created_at DESC LIMIT 1`.
- **`monthlyChangesSchedulerTick` uses one Supabase marker for the whole client loop.** If it dies partway through, remaining clients are skipped for the week. Per-client markers are a future hardening.
- **`audit_scope_tier` write path.** `audit_parent` reads it from Airtable but `audit_inventory` does not currently write it to Airtable (only emits it in result JSON). Once the field exists in Airtable, restore the write in `audit_inventory.md` Step 8 patch fields.
- **`keyword_groups` empty → `title_generation` silent skip.** If `keyword_research` fails or hasn't run, every subsequent `title_generation` exits with `{"status":"error","reason":"keyword_research not yet run — client has no keyword groups"}`. Surface as a portal banner in a future iteration.

---

## Conventions

- SOPs are loaded by exact filename. Renaming a SOP requires updating every `sop_name: "..."` reference (use `grep -rn "<old_name>" worker/ dashboard/` before deploying).
- Don't put runnable SOPs in `worker/sops/_examples/` — that subdirectory is unreachable from `loadSop()`.
- Always type-check the worker locally before deploying: `cd worker && npx tsc --noEmit`.
- All Airtable-touching code paths must surface "missing env var" via `console.warn` — no silent returns.
