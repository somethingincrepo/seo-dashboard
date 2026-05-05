# Content pipeline fix — deployment checklist

This change ships fixes for: content profile (all 8 portal fields), internal-links observability, content-refresh first-batch enqueue, n8n webhook payload + watchdog, and admin Content Jobs observability.

## Required schema work

These cannot be applied programmatically — they need manual setup in Airtable and Supabase before the deploy is fully effective. The code is forward-compatible: deploying *before* the schema work just means the new fields are silently skipped on writes and missing in reads.

### 1. Airtable — Content Jobs table (content base `appdubb0WZgmrJNIB`)

Add three fields:

| Field name              | Type        | Notes                               |
|-------------------------|-------------|-------------------------------------|
| `webhook_retry_count`   | Number      | Integer. Default 0. Used by watchdog. |
| `webhook_last_retry_at` | Date & time | ISO 8601 with timezone.             |
| `webhook_error`         | Long text   | Most recent webhook failure message. |

These are written by:
- `dashboard/app/api/portal/titles/route.ts` (initial Webhook Failed)
- `worker/src/index.ts` `contentJobWatchdogTick` (retries and escalation)
- `dashboard/app/api/admin/content-jobs/route.ts` (manual retry button)

### 2. Supabase — `audit_runs` table

Run the migration at `dashboard/supabase/migrations/20260505_audit_runs_summary_columns.sql`:

```sql
ALTER TABLE audit_runs
  ADD COLUMN IF NOT EXISTS internal_links_summary jsonb,
  ADD COLUMN IF NOT EXISTS completion_summary jsonb;
```

Surfaced on the admin client detail page (`/clients/[id]`) as the "Latest Audit Pipeline" panel and on the portal internal-links empty state.

## Required env vars

- `N8N_CONTENT_WEBHOOK_URL` — must be set in Vercel (dashboard) and on the Fly worker. The previous hardcoded fallback URL has been removed; with this var unset, title approvals will mark records as `Webhook Failed` immediately rather than silently using a guessed URL.

## Deploy order

1. **Add Airtable fields** (above) — safe to do anytime.
2. **Run Supabase migration** — safe to do anytime.
3. **Deploy dashboard** — `git push` from `dashboard/` (Vercel auto-deploys).
4. **Deploy worker** — `fly deploy` from `worker/` directory.

The dashboard and worker are independently safe to redeploy in either order; the watchdog and the portal don't depend on each other for correctness.

## Smoke test on next onboarded client

1. Trigger an audit. Within ~5 min, check:
   - `audit_runs` row has `status='complete'`, `internal_links_summary` and `completion_summary` populated.
   - Supabase `jobs` shows `generate_content_profile`, `keyword_research`, `refresh_scheduler` all enqueued (or status=done).
   - Content base Clients row has all 8 profile fields populated.
2. Open the portal:
   - `/portal/<token>/content/profile` shows all 8 fields, no blank cards.
   - `/portal/<token>/internal-links` either lists proposals or renders the new "your internal linking is healthy" message with the audit-derived rationale.
3. Approve a title in `/portal/<token>/content/titles`. Check Airtable Content Jobs:
   - `Status = "Queued"`, `Content type` is a clean string (not JSON object).
   - n8n produces an article body within ~5 min.
   - If n8n fails, watch for `webhook_retry_count` to increment 30 min later.
4. Admin Activity page (`/activity`) shows the Content Jobs counts and retry button works on a stuck record.
