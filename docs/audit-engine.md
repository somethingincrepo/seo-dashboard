# Audit Engine

A deterministic, repeatable rules engine that replaces the previous agentic audit.
The whole point of this rewrite is **repeatability**: two consecutive runs on the
same site must produce identical issue lists.

## Architecture

```
[ POST /api/intake ]
        │  intake form submission
        ▼
[ triggerAudit() ]
        │  inserts audit_runs row, POSTs Fly crawler webhook
        ▼
[ Fly: services/crawler ]
        │  Crawlee + Playwright crawl
        │  + site-level fetches (robots, sitemap, llms.txt, HTTPS, HSTS)
        │  + post-crawl link graph + dup detection + canonical/og probes
        │  writes pages rows, marks audit_runs.status = 'crawled'
        ▼
[ POST /api/audit/diagnose ]   (called by crawler with shared bearer token)
        │  loads pages + audit_runs
        │  runs all 75 rules deterministically
        │  bulk-inserts issues, marks audit_runs.status = 'complete'
        ▼
[ /portal/[token]/audit ]      (client-facing)
[ /audit and /audit/[id] ]     (admin)
```

Every step writes to Supabase. No state lives in memory across processes.

## Adding a new rule

Each rule is a tiny pure function in [`lib/audit/rules/`](../lib/audit/rules/).

1. Create `lib/audit/rules/R0XX-<slug>.ts`. Export a `PageRule` or `SiteRule`.
2. Register it in [`lib/audit/rules/index.ts`](../lib/audit/rules/index.ts) — add the import and push to `PAGE_RULES` or `SITE_RULES`.
3. Add a passing + failing fixture in [`lib/audit/rules/__tests__/rules.test.ts`](../lib/audit/rules/__tests__/rules.test.ts).
4. Run `npm test` — the registry test asserts `ALL_RULES.length === 75`; bump that constant when adding rules.

A rule must:
- Be a pure function of `(page, ctx)` or `(ctx)` for site-scope.
- Return `null` when no violation.
- Return a violation with stable `current_value` text (no timestamps, no random ordering, no LLM calls).

A rule must NOT:
- Make network calls.
- Read process.env.
- Call any LLM.
- Depend on the iteration order of `Object.keys` for anything load-bearing.

## Page extraction

The crawler extracts every field on the `pages` table from the rendered DOM and HTTP response. See [`services/crawler/src/extractor.ts`](../services/crawler/src/extractor.ts).

Fields that require post-crawl computation (because they need the full link graph):
- `internal_links_in` — count of inbound internal links
- `click_depth` — BFS from root over the in-crawl link graph
- `duplicate_of_url` — content-hash collision among indexable 200s
- `canonical_status_code`, `og_image_status` — HEAD probe of the referenced URL
- `broken_links_out` — sampled HEAD probes of outbound links
- `in_sitemap` — set membership against the site's sitemap URL list

These are computed in [`services/crawler/src/post-crawl.ts`](../services/crawler/src/post-crawl.ts).

## Site-level checks

Some rules apply to the site as a whole, not a single page (e.g. "robots.txt missing"). The crawler runs:
- `GET /robots.txt`, `/llms.txt`, `/llms-full.txt`
- Sitemap discovery (well-known paths + `Sitemap:` directive in robots.txt + sitemap index recursion)
- HTTPS-enforcement probe (does the http:// origin redirect to https://?)
- HSTS header presence

Results land on `audit_runs` (not `pages`). Site-scope issues have `page_id = null`.

## Running an audit manually

There's no UI button by design — audits fire automatically on intake form submission. For QA:

1. Insert an `audit_runs` row by hand and POST to the Fly crawler `/crawl`, **or**
2. Use the admin "Run again now" button on `/audit/[id]` (calls `POST /api/audit/start` with admin auth).

## Repeatability test (Phase 1 acceptance gate)

The admin run-detail page (`/audit/[id]`) has a **Run again now** button + comparison panel.

After a second run completes, the panel diffs the issue lists across runs:
- `pages_crawled` should match.
- Issue count should match exactly.
- The fingerprint diff (`rule_id::scope::page_url::current_value`) should be empty.

Any non-zero diff means the engine has a non-determinism bug. Common culprits to check first:
- A rule branching on `Date.now()` or `Math.random()`.
- The crawler's link enqueue order producing different page subsets across runs (URL normalization should prevent this — verify [`services/crawler/src/url.ts`](../services/crawler/src/url.ts)).
- Sampled probes (`broken_links_out`) exceeding their cap and varying which links are tested. Order them deterministically before slicing.

## Phase boundaries

- **Phase 1 (this).** Schema, crawler, rules engine, dashboard surfaces, repeatability gate. No generation. No agentic enrichment.
- **Phase 2.** Per-rule "Why this matters" enrichment. Static description text remains the fallback. Agentic call is one-shot per issue, cached in `issues.evidence`.
- **Phase 3.** Bulk-issue triage UI in the portal — group by rule, accept/reject, page-level overrides.
- **Phase 4.** Generation agent. Writes `proposed_value` per issue. Wires into the existing Approvals queue.
- **Phase 5.** Sunset the old agentic audit code in `worker/sops/audit_*.md`.
