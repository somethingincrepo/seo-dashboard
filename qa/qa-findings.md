# Dashboard QA — Findings

Date: 2026-05-07
Scope: All client-facing dashboard surfaces + Fly worker tickers.
Out of scope: Reddit/Engain features, WordPress-implementation SOPs.
Severity: P0 broken · P1 silent failure / data integrity · P2 UX gap / design risk · P3 polish

Status legend per finding: **CONFIRMED** (evidence in code), **UNVERIFIED** (requires live API or runtime probe), **REFUTED** (initial agent reports were wrong).

---

## S0 — Cross-cutting infrastructure

### [P0][S0] F-001 — Worker has no global error handler; silent exits halt all monthly automation
**Where:** `worker/src/index.ts:872-979`
**Status:** CONFIRMED
**Symptom:** `main()` is invoked via `void main()` at line 979 with no `process.on('uncaughtException')`, no `process.on('unhandledRejection')`, no try/catch around `setInterval` callbacks. Memory documents the worker exiting after batches.
**Impact:** When the worker dies, every monthly deliverable stops firing — title generation, refreshes, reports, internal links, month_number rollover. Dashboard cron is just a backstop; it cannot replace the worker. The whole platform looks broken to clients in <24h of worker death.
**Evidence:** No `process.on` calls in `worker/src/index.ts`. Memory: "Worker exits after processing a batch of jobs despite setInterval. Suspected unhandled exception."

### [P1][S0] F-002 — `scheduled_for_month` field may not exist in Content Airtable schema
**Where:** `app/api/portal/titles/route.ts:303` (write), `worker/src/index.ts:437` (read filter), `worker/src/index.ts:481` (write null on activation)
**Status:** UNVERIFIED — requires live Airtable schema check
**Symptom:** Code writes/reads `scheduled_for_month` on Content Jobs records. Memory says writes return 422 UNKNOWN_FIELD_NAME on bases not migrated. If field is missing, the entire next-month buffering chain is silently broken: PATCH to `next_month` fails the field write but might still flip `title_status`, leaving an orphaned state.
**Impact:** When monthly title quota is exhausted, the "queued for next month" UX shows the success message to the user but the record either fails to write or never promotes — title is lost.
**Evidence:** Memory `project_n8n_content_pipeline.md` line 73: `scheduled_for_month field does NOT exist in Airtable schema yet (code references it but writes fail with 422)`.

### [P1][S0] F-003 — `title_status="next_month"` may not be a valid select option in Airtable
**Where:** `app/api/portal/titles/route.ts:302`, `worker/src/index.ts:437`
**Status:** UNVERIFIED — requires schema check
**Symptom:** Code writes `title_status: "next_month"` (added 2026-05-05 per code comment). Airtable rejects writes to single-select fields with unknown options.
**Impact:** Same chain-break as F-002 — quota-buffered titles never persist.
**Evidence:** Memory previously noted only valid values: titled, approved, skipped, generating, completed, published.

### [P2][S0] F-004 — `webhook_error` field may not exist in Content Airtable schema
**Where:** `app/api/portal/titles/route.ts:34`
**Status:** UNVERIFIED
**Symptom:** Failure path silently swallows the field-write error: `await contentAirtablePatch(...).catch(() => {})` with comment "webhook_error field may not exist yet — non-fatal."
**Impact:** When n8n rejects an article, the operator-facing error message is lost. Watchdog still escalates Status="Webhook Failed" so retry path works, but post-mortem context vanishes.

### [P2][S0] F-005 — Plaintext `portal_password` is stored in Airtable alongside the hash, persists after client password change
**Where:** `app/api/intake/route.ts:165`, `app/api/clients/create/route.ts:138,193`, `app/api/portal/settings/change-password/route.ts:42`, `lib/clients.ts:69` (typed as plaintext)
**Status:** CONFIRMED
**Symptom:** Plaintext is stored intentionally for admin-reference (so admins can copy and share). But `change-password` route ALSO writes the new plaintext password — even though the user's intent in changing it is secrecy.
**Impact:** Any Airtable-token leak exposes every client's portal credential. After self-service password change, the admin still sees the new plaintext — defeats the security purpose of password change. Client could reuse the same password elsewhere; agency holds it forever.
**Evidence:** `lib/clients.ts:69` types it as `string` with comment `plaintext — stored for admin reference`. `change-password/route.ts:42` writes it back on user-initiated change.

### [P2][S0] F-006 — Only one Vercel cron exists; system depends entirely on Fly worker uptime
**Where:** `vercel.json:2-4`
**Status:** CONFIRMED
**Symptom:** Only the `weekly-health-check` cron is defined. `/api/reports/schedule`, `/api/cron/dispatch` and any other admin-callable endpoints are not on a schedule.
**Impact:** No redundancy — if Fly is down, only the Monday backstop fires. No dashboard-side daily tick exists for report scheduling, month rollover, or content scheduling.

---

## S1 — Client onboarding

### [P1][S1] F-101 — `portal_username` collision not checked at intake
**Where:** `app/api/intake/route.ts:119,143`
**Status:** CONFIRMED
**Symptom:** `portal_username = client_id = slugify(company_name)`. No uniqueness check against existing clients before creating the record.
**Impact:** Two clients with similar names ("Acme Inc" and "Acme, Inc.") slugify identically → second intake creates a duplicate username. `findClientByUsername` (in portal-auth) likely returns the first match → second client cannot log in, or worse, logs into the first client's portal if password happens to collide.
**Evidence:** Code only checks `site_url` for duplicates (line 127-136), not `portal_username`.

### [P2][S1] F-102 — Guide page documents wrong refresh quotas for Growth and Authority
**Where:** `app/portal/[token]/guide/page.tsx:497-506`
**Status:** CONFIRMED
**Symptom:** Guide shows: Starter "2 refreshes" ✓, Growth "4 refreshes" ✗ (should be 6), Authority "8 refreshes" ✗ (should be 12). PACKAGES (`lib/packages.ts:21,29,37`) is canonical: 2/6/12.
**Impact:** Direct mis-promise to clients. Growth/Authority clients see a smaller number on the guide than they're owed → confusion + perceived underdelivery despite system actually shipping more.

### [P2][S1] F-103 — Guide page documents wrong title bottleneck threshold
**Where:** `app/portal/[token]/guide/page.tsx:415-418`
**Status:** CONFIRMED
**Symptom:** Guide says "the system will pause title generation if you have 5 or more titles already waiting." Actual TITLE_BOTTLENECK is 6 / 10 / 16 per tier (`lib/packages.ts:53-57`).
**Impact:** Clients on Growth/Authority will see 8 or 14 pending titles before pause — either confused ("guide said 5, why are there 12?") or escalating to support thinking system is broken.

### [P3][S1] F-104 — Guide says titles are "2-4 proposed per month"; reality is 2/3/4 per RUN, multiple runs/month possible
**Where:** `app/portal/[token]/guide/page.tsx:407`
**Status:** CONFIRMED
**Symptom:** Wording is ambiguous about whether 2-4 is per month or per run. Per `lib/packages.ts:59-63` and `worker/sops/content_scheduler.md`, it's per run, and `schedulerTick` runs daily — so a client could see far more than 4 per month.
**Impact:** Mild — clients may underestimate title volume.

### [P2][S1] F-105 — No GA4 OAuth flow in portal; GA4 connection is admin-only / service-account
**Where:** `app/portal/[token]/settings/page.tsx:230` (mentions "GA4" in section label only)
**Status:** CONFIRMED
**Symptom:** Settings page lists "Integrations: GSC, GA4 & more" but no GA4 connect UI exists. GA4 data appears in reports (`app/portal/[token]/reports/page.tsx:331-342` reads `ga4_*` fields from Supabase reports), implying agency-side service-account configuration.
**Impact:** Self-serve onboarding cannot complete GA4 hookup → reports show "Not connected" for GA4 panel until agency intervenes manually. Onboarding doc/guide should set this expectation.

### [P3][S1] F-106 — Intake idempotency check rejects on `site_url` only — not on contact_email or company_name
**Where:** `app/api/intake/route.ts:127-136`
**Status:** CONFIRMED
**Symptom:** Trailing-slash-stripped exact-match dedup on site_url; no fuzzy match (e.g., "https://x.com" vs "https://x.com/" already handled, but "https://www.x.com" not).
**Impact:** Edge case — a re-submission with `www.` prefix would create a second record. Not a high-risk bug, but worth a normalize-and-strip-www on dedup.

---

## S2 — Audit pipeline

### [P3][S2] F-201 — `audit_run_id` linkage between Pages and Changes is read-only confirmed; not E2E tested in this QA
**Status:** UNVERIFIED — requires test client run
**Symptom:** SOPs read Pages by `{audit_run_id}="..."` and Clients by `RECORD_ID()="..."` per memory. Can only be confirmed by running `audit_parent` against a test client and checking the Pages records get the right `audit_run_id`.
**Impact:** Wrong filter form has caused historical SOP failures (memory). Worth re-confirming after any worker SOP edit.

### [P2][S2] F-202 — Audit dimension SOPs not validated for correct `auto_executable` / `requires_design_review` flags
**Status:** UNVERIFIED
**Symptom:** No code-level confirmation that each dimension SOP correctly sets `auto_executable=true` only for safe types (Metadata/Alt Text/Internal Link/Canonical) and `requires_design_review=true` for visual/layout changes.
**Impact:** Mis-flagged Changes either auto-execute when they shouldn't (P0 if visual change ships without review) or get stuck in `manual_required` when they should auto-run.
**Action:** During E2E walk, sample one Change of each type and verify the flags. Documented in fix-pack as a probe rather than a code change.

---

## S3 — Approvals workflow

### [P1][S3] F-301 — Quota enforcement only covers Internal Link type — FAQ, Heading, Schema, etc. have no quota gate
**Where:** `app/api/approvals/route.ts:16-19`
**Status:** CONFIRMED
**Symptom:** `TYPE_QUOTAS` map only contains `"Internal Link"` and `"Internal Links"`. PACKAGES promises monthly counts for `faq_sections`. There is no Changes-side enforcement for FAQs.
**Impact:** Audits that surface 50 FAQ Changes can all be approved past tier quota (1/3/6). The agency takes on more delivery work than billed. (Worker may dedupe through capacity limits, but the contract is "1/3/6 per month" — UI never blocks it.)
**Evidence:** `MonthlyProgress.tsx:153` counts `typeCount["FAQ"]` actuals — UI shows the quota but approval endpoint doesn't enforce it.

### [P1][S3] F-302 — `MonthlyProgress` tracks Reddit comments via Changes type but no SOP writes Reddit-type Changes
**Where:** `components/portal/MonthlyProgress.tsx:156`
**Status:** CONFIRMED
**Symptom:** `reddit_comments: typeCount["Reddit"] ?? typeCount["Reddit Comment"] ?? 0`. Engain mentions are tracked elsewhere (out-of-scope for this QA but the counter is on the dashboard for non-Reddit-disabled clients).
**Impact:** Reddit MTD count shows 0/N forever for tiers that include Reddit comments. UX bug, not data integrity. (User has marked Reddit work out of scope; flagged here only because the counter is misleading.)

### [P2][S3] F-303 — Articles "delivered" counted from `Status="Completed"`, not `Status="Published"`
**Where:** `components/portal/MonthlyProgress.tsx:131-145`
**Status:** CONFIRMED — design ambiguity, not strict bug
**Symptom:** Counts Content Jobs where `Status="Completed"` — i.e., n8n drafted them but they haven't been published yet. Client perspective: "delivered = published"; agency perspective: "delivered = drafted ready for review".
**Impact:** Discrepancy between portal counter and what client sees on their site → confusion. Decide on a definition and align.

### [P2][S3] F-304 — No portal-side Reverts UI; client cannot undo decisions even pre-implementation
**Where:** `lib/changes.ts:108-156` exists; no UI consumes it from `/portal/[token]/`
**Status:** CONFIRMED
**Symptom:** `revertDecision()` (undo non-pending → pending) and `resetChange()` (reset reverted → pending) are backend-only. Portal master-detail (`ApprovalMasterDetail`) only exposes Approve/Skip/Question per item, no "Undo" button.
**Impact:** Client cannot self-correct mistakes. Has to email agency to reverse.

### [P3][S3] F-305 — No category-level consent gating for AI-GEO
**Where:** `app/portal/[token]/approvals/[category]/page.tsx`
**Status:** CONFIRMED
**Symptom:** Category routes are pure UI filters; all categories use the same `/api/approvals` endpoint without category-specific consent flow.
**Impact:** Likely intentional. Flag as design question — should AI-GEO require an extra "I understand schema injection" toast?

---

## S4 — Internal links

### [P3][S4] F-401 — No portal "Generate internal links now" button
**Where:** `app/portal/[token]/internal-links/page.tsx`
**Status:** CONFIRMED
**Symptom:** Generation runs weekly via `monthlyChangesSchedulerTick` + dashboard backstop. No client-initiated trigger.
**Impact:** If a client expects fresh proposals on demand, they have to wait up to a week. Optional UX feature, not bug.

### [P3][S4] F-402 — `audit_runs.internal_links_summary` column may not exist on older Supabase deployments
**Where:** `app/portal/[token]/internal-links/page.tsx:60-80`
**Status:** UNVERIFIED — code already best-effort handles missing column
**Symptom:** Try/catch already swallows the error; UI degrades to no summary panel. Check whether prod Supabase has this column.

---

## S5 — Content pipeline

### [P0][S5] F-501 — `PUT /api/portal/content-schedule` skips both past-date and occupied-date validation
**Where:** `app/api/portal/content-schedule/route.ts:103-135`
**Status:** CONFIRMED
**Symptom:** PUT validates `isWeekday` only. Does not check `if (d < tomorrow)` (past dates allowed) and does not check `occupied.has(new_date)` (collisions allowed). PATCH (lines 48-98) does both. No rate limit.
**Impact:** A portal client can call PUT to assign a publish date that's already taken by another client, breaking the global one-article-per-weekday lock. Or backdate to before today. Enables both accidental and adversarial misuse.
**Severity rationale:** Authenticated portal endpoint — limited blast radius — but core scheduling invariant is violated.

### [P1][S5] F-502 — `content-review` approval is not atomic: portal_approval succeeds but scheduled_publish_date may fail
**Where:** `app/api/portal/content-review/route.ts:29-48`
**Status:** CONFIRMED
**Symptom:** Two sequential PATCHes — first sets `portal_approval=approved`, then a separate PATCH sets `scheduled_publish_date`. Second has try/catch that logs but doesn't roll back. If second fails, article is approved but unscheduled — `publisherTick` will never publish it because it filters on `scheduled_publish_date <= today`.
**Impact:** Silent loss of delivered content. Client thinks it's queued; agency sees "approved" record sitting indefinitely.

### [P1][S5] F-503 — Activity feed never logs `title_status="skipped"` events
**Where:** `app/portal/[token]/activity/page.tsx:153-162`
**Status:** CONFIRMED
**Symptom:** Loop only emits content events for `proposed_at` and `approved_at`. DELETE on titles writes `title_status: "skipped"` but does NOT set a `skipped_at` timestamp (`app/api/portal/titles/route.ts:458`), so even if activity feed checked for it, there'd be no date to use.
**Impact:** Skipped titles vanish from changelog → client cannot audit their own decisions. Agency cannot review skip patterns.

### [P2][S5] F-504 — Activity feed treats `title_status === "published"` as the published event but only fires when `approved_at` exists
**Where:** `app/portal/[token]/activity/page.tsx:158-161`
**Status:** CONFIRMED
**Symptom:** A published article must have an `approved_at` to emit a `published` event. Worker's `publisherTick` flips `title_status="published"` but doesn't update `approved_at` (it's already set). So the existing event becomes "approved → published" — but the timestamp shown is `approved_at`, not the publish date.
**Impact:** Activity feed shows the publish event at the wrong date (approval date, not publish date).

### [P0][S5] F-505 — `/api/portal/titles` PATCH on quota-full path may silently fail Airtable write if `scheduled_for_month` field missing
**Where:** `app/api/portal/titles/route.ts:301-316`
**Status:** UNVERIFIED — depends on F-002/F-003
**Symptom:** Single PATCH writes `title_status: "next_month"` AND `scheduled_for_month: nextMonth`. If either field is missing in schema, ENTIRE patch returns 422 — and the response message claiming "queued for next month" misleads the user. Code at line 309 doesn't try/catch the patch.
**Impact:** Client sees "your article has been queued for June" success toast, but record is unchanged in Airtable. Worker activator never finds it. Title is effectively skipped.

### [P1][S5] F-506 — `/api/content-approval` and `/api/portal/titles` both fire n8n webhook on the same approval path
**Where:** `app/api/content-approval/route.ts:49-76`, `app/api/portal/titles/route.ts:391-417`, `components/portal/useArticleActions.ts:27`, `lib/content.ts:267,279,295`
**Status:** CONFIRMED — refutes earlier "dead code" hypothesis
**Symptom:** `useArticleActions.ts` hits `/api/content-approval` for article-side actions; `/api/portal/titles` PATCH fires the webhook independently for title approvals. Plus the Airtable automation `status_change` fires the webhook a third time when Status flips to Queued. Up to triple-trigger.
**Impact:** n8n receives 1-3 webhook calls per approval. n8n's dedup is unknown — at minimum wasted compute, at worst duplicate articles. Memory acknowledged double-trigger as "acceptable for now" — but this is triple, not double.

### [P2][S5] F-507 — Content profile `getContentClientId()` lookup uses unescaped company name
**Where:** `app/api/portal/titles/route.ts:18-24`
**Status:** CONFIRMED
**Symptom:** `filterByFormula: \`{Client Name}="${companyName}"\`` — no escape for double-quotes in company names.
**Impact:** A company named `Foo "The" Bar` causes an INVALID_FILTER_BY_FORMULA error → returns null → next code path auto-creates a duplicate Content client record.

### [P3][S5] F-508 — Content kanban filter on lookup field requires exact company-name match; renames break it
**Where:** `lib/content.ts` (`getContentJobsForClient`), `app/api/portal/titles/route.ts:84-88` (FIND+ARRAYJOIN)
**Status:** CONFIRMED
**Symptom:** Filter is `FIND("${companyName}",ARRAYJOIN({Client Name (from Client ID)},","))` — substring match on lookup. Two clients ("Acme" and "Acme Co") share matches.
**Impact:** Cross-client data leak in lookups when one company's name is a substring of another's.

---

## S6 — Content optimization (refreshes)

### [P3][S6] F-601 — Content optimization has no portal "request a refresh of this URL" button
**Where:** `app/api/portal/content-optimization/route.ts`
**Status:** CONFIRMED
**Symptom:** POST endpoint accepts `type=approve` and `type=edit_proposed`, no `type=request`. Refresh selection is SOP-only.
**Impact:** Portal user cannot self-serve refresh requests — but content_refreshes are auto-scheduled, so this is optional UX.

### [P2][S6] F-602 — Refresh quota check not enforced server-side
**Status:** UNVERIFIED — requires reading `worker/sops/refresh_scheduler.md` + content-optimization API
**Symptom:** Need to confirm whether the SOP itself caps at `PACKAGES[tier].content_refreshes` per month vs whether the portal approval endpoint blocks.
**Action:** Code-level read of refresh_scheduler SOP to confirm.

---

## S7 — Reports

### [P2][S7] F-701 — `reportSchedulerTick` and `/api/reports/schedule` are duplicate implementations
**Where:** `worker/src/index.ts:986+` (worker tick), `app/api/reports/schedule/route.ts:16-99` (admin endpoint)
**Status:** CONFIRMED
**Symptom:** Both create `report_generate` jobs with the same idempotency check (one per client per month). Operator confusion: which is canonical?
**Impact:** Mostly cosmetic — both have the same dedup so no double-generation — but maintenance burden.

### [P3][S7] F-702 — Live GSC SSR query path will 500 on missing `gsc_property` if not gracefully handled
**Status:** UNVERIFIED
**Action:** Confirm SSR reports page renders when `gsc_property` is empty (e.g., during onboarding).

---

## S8 — Indexation

### [P3][S8] F-801 — Indexing API submission on approval has no retry / failure surfacing
**Where:** `app/api/approvals/route.ts:202-209`
**Status:** CONFIRMED
**Symptom:** Background `submitUrlToIndexingAPI(pageUrl).then(...).catch(() => {})` — total failure-swallow.
**Impact:** If Google's API is rate-limited or rejects, the client sees no warning. The `indexing_status` is just left null. Manual portal submit is the recovery path; user might not know to use it.

---

## S9 — Deliverables (promises vs actuals)

### [P2][S9] F-901 — `/portal/[token]/deliverables` page shows monthly promises only, no MTD progress
**Where:** `app/portal/[token]/deliverables/page.tsx:174-218`
**Status:** CONFIRMED
**Symptom:** Renders counts from `pkg[key]` — no comparison against MonthlyProgress actuals.
**Impact:** Two pages disagree:
- Sidebar (MonthlyProgress) shows `3/6 refreshes`
- Deliverables page shows `6 refreshes per month`
Client has no single source of truth.

### [P1][S9] F-902 — `monthAdvanceTick` only increments month_number for `plan_status="active"` clients
**Where:** `worker/src/index.ts:1093-1124`
**Status:** CONFIRMED
**Symptom:** Filter is `{plan_status}="active"`. Clients in `month1_audit` or `month1_audit_complete` (the post-onboarding states before transition to active) are skipped. There's no code visible that transitions `plan_status` from `month1_audit_complete` → `active`.
**Impact:** Clients stuck in `month1_audit_complete` will never have their month_number incremented, and may never transition to active without manual intervention. UI shows "Month 1" forever.

### [P2][S9] F-903 — `monthAdvanceTick` is calendar-month, not anniversary-based
**Where:** `worker/src/index.ts:1062-1124`
**Status:** CONFIRMED
**Symptom:** A client onboarded on the 28th has month_number bumped 3 days later when the next calendar month starts. Their "month 1" is 3 days long.
**Impact:** Month-by-month deliverable tracking is misaligned with billing/intake date. Either deliberate (everyone on same calendar cadence) or accidental (anniversary expected). Decide.

---

## S10 — Cross-cutting

### [P2][S10] F-1001 — Webhook double/triple-trigger: portal route + Airtable automation + content-approval route
**Where:** See F-506. Airtable automation `status_change` fires when `Status="Queued"` is detected.
**Status:** CONFIRMED
**Impact:** Documented in F-506; tracked here too because it crosses dashboard + Airtable + n8n.

### [P3][S10] F-1002 — Auth middleware coverage not E2E verified
**Where:** `proxy.ts`
**Status:** UNVERIFIED
**Action:** Curl probe each protected admin route without admin cookie → expect 302/401. Curl portal route with invalid token → expect 401/redirect.

---

## E2E walks — execution status

These walks were specified in the plan but not run during this code-level pass. Mark UNVERIFIED until executed against a test client.

| Walk | Status | Notes |
|---|---|---|
| Onboarding (invite → intake → audit) | UNVERIFIED | Code paths confirmed; no live run |
| Approval (approve Metadata → see implement job) | UNVERIFIED | |
| Internal-link quota enforcement | UNVERIFIED | |
| Content (keyword group → title → article → publish) | UNVERIFIED | n8n external pipeline cannot be mocked |
| Quota-buffer (exhaust title quota → next_month → activate) | UNVERIFIED | Depends on F-002/F-003 schema verification |
| Refresh (refresh_scheduler → portal approve → publish job) | UNVERIFIED | |
| Report (report_day → reportSchedulerTick → Supabase report) | UNVERIFIED | |
| Indexation (auto-inspect + manual submit) | UNVERIFIED | |

To execute:
1. Provision Growth-tier test client via admin tokens page → take note of portal_token + portal_password
2. Login portal at `/portal/login`
3. Walk each step; note actuals vs expected
4. Append results to this section
5. For each FAILED walk, create a corresponding F-### finding above

---

## Summary by severity

- **P0 (broken):** F-001 worker exits, F-501 PUT bypasses scheduling lock, F-505 quota-buffer silent failure
- **P1 (silent failure / data integrity):** F-002 schema, F-003 schema, F-101 username collision, F-301 FAQ quota, F-302 Reddit count broken, F-502 non-atomic approval, F-503 skipped titles drop, F-506 webhook triple-trigger, F-902 stuck month_number
- **P2 (UX gap / design risk):** F-004, F-005, F-006, F-102, F-103, F-105, F-202, F-303, F-304, F-504, F-507, F-602, F-701, F-901, F-903, F-1001
- **P3 (polish):** F-104, F-106, F-201, F-305, F-401, F-402, F-508, F-601, F-702, F-801, F-1002

Total: 33 findings, 3 P0, 9 P1, 16 P2, 11 P3 (some P3 are also UNVERIFIED).
