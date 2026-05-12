# Dashboard QA — Fix Pack

Date: 2026-05-07
Companion to `qa-findings.md`. Each fix is self-contained: file + lines + before/after + verify step.

**Execute in this order:**
1. Phase A — Cross-cutting blockers (schema, env, infra) — these unblock dependent fixes
2. Phase B — P0 fixes
3. Phase C — P1 fixes (data-integrity / silent-failure)
4. Phase D — P2 fixes (UX gaps / design risks)
5. Phase E — P3 polish (only if time permits)

After each fix, run the `Verify` step before moving on. Commit per surface (S1, S3, S5 etc.) so reviews stay scoped.

**General workflow rules:**
- Always read the file first before edit (the AGENTS.md note says Next.js 16 has breaking changes — read `node_modules/next/dist/docs/` if any Next-API surface is touched).
- After dashboard code edits: `git push` (Vercel deploys automatically — see memory).
- Worker code edits require `cd ~/Desktop/Claude/worker && fly deploy` to take effect.
- Don't `git commit` unless the user explicitly asks.

---

# PHASE A — Cross-cutting blockers

## A1 — Verify (and add) Airtable schema fields

**Why:** F-002, F-003, F-004, F-505 all depend on three schema items that may not exist in production.

**Verification commands** (run from anywhere):
```bash
# CONTENT BASE — Content Jobs table fields
curl -s "https://api.airtable.com/v0/meta/bases/appdubb0WZgmrJNIB/tables" \
  -H "Authorization: Bearer $CONTENT_AIRTABLE_API_KEY" \
  | jq '.tables[] | select(.name=="Content Jobs") | .fields[] | {name, type, options: (.options.choices? // null)}'
```

Look for:
1. **`scheduled_for_month`** — must exist as `singleLineText` (or `date` with month-year format). If missing → add via Airtable UI.
2. **`webhook_error`** — must exist as `multilineText`. If missing → add via Airtable UI.
3. **`title_status` select options** — must include all of: `titled`, `approved`, `skipped`, `generating`, `completed`, `published`, `next_month`. If `next_month` is missing → add via Airtable UI (Field → Customize field type → Options → Add `next_month`).

**Verify after adding:** Re-run the curl above. Confirm all three present.

**Risk:** Adding a select option in Airtable is non-destructive. Adding a text field is non-destructive. Don't try to add via REST — use the UI.

---

## A2 — Worker: add global error handlers (fixes F-001)

**File:** `worker/src/index.ts`
**Lines:** 977-979 (just before the existing `void main()` call)

**Change — Before:**
```ts
}

void main();
```

**Change — After:**
```ts
}

// Surface fatal failures so Fly's restart policy actually fires instead of the
// process going zombie. Memory documents the worker exiting after batches with
// no observable cause — without these handlers an unhandled rejection inside a
// setInterval callback silently kills the loop.
process.on("uncaughtException", (err) => {
  console.error("[worker] uncaughtException — exiting for Fly to restart:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[worker] unhandledRejection — exiting for Fly to restart:", err);
  process.exit(1);
});

void main().catch((err) => {
  console.error("[worker] main() rejected — exiting:", err);
  process.exit(1);
});
```

**Why:** When a tick callback throws, Node logs an unhandled-rejection warning and continues with a half-broken event loop. By exiting on these, Fly's process manager auto-restarts the machine and tickers come back. Combined with `fly.toml` restart_policy this is the standard supervisor pattern.

**Verify:**
1. Deploy: `cd ~/Desktop/Claude/worker && fly deploy`
2. SSH or `fly logs -a seo-worker-winter-tree-4075` and confirm boot log shows `[worker] starting`
3. Force a transient error: temporarily revoke ANTHROPIC_API_KEY env var → confirm worker exits and restarts (don't actually do this on prod; do it in a Fly dev volume)

**Risk:** Worker will now exit on previously-survived errors. Net win, but watch logs the first day after deploy for unexpected restarts.

---

## A3 — Add a dashboard-side daily backstop cron for monthlyActivatorTick + reportSchedulerTick (mitigates F-001)

**File:** `dashboard/vercel.json`
**Lines:** 2-4

**Change — Before:**
```json
{
  "crons": [
    { "path": "/api/cron/weekly-health-check", "schedule": "0 13 * * 1" }
  ],
```

**Change — After:**
```json
{
  "crons": [
    { "path": "/api/cron/weekly-health-check", "schedule": "0 13 * * 1" },
    { "path": "/api/cron/daily-backstop", "schedule": "0 13 * * *" }
  ],
```

Then create `dashboard/app/api/cron/daily-backstop/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { airtableFetch, airtablePatch } from "@/lib/airtable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONTENT_BASE = process.env.CONTENT_AIRTABLE_BASE_ID!;
const CONTENT_KEY = process.env.CONTENT_AIRTABLE_API_KEY!;

async function runMonthlyActivator(): Promise<{ activated: number }> {
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const url = new URL(`https://api.airtable.com/v0/${CONTENT_BASE}/${encodeURIComponent("Content Jobs")}`);
  url.searchParams.set(
    "filterByFormula",
    `AND({title_status}="next_month",{scheduled_for_month}<="${currentMonth}")`
  );
  url.searchParams.set("maxRecords", "100");

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${CONTENT_KEY}` } });
  if (!res.ok) return { activated: 0 };
  const data = await res.json() as { records: Array<{ id: string }> };
  let activated = 0;
  for (const r of data.records ?? []) {
    await fetch(
      `https://api.airtable.com/v0/${CONTENT_BASE}/${encodeURIComponent("Content Jobs")}/${r.id}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${CONTENT_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { title_status: "approved", Status: "Queued", approved_at: new Date().toISOString(), scheduled_for_month: null } }),
      }
    );
    activated++;
  }
  return { activated };
}

async function runReportScheduler(): Promise<{ enqueued: number }> {
  const supabase = getSupabase();
  const today = new Date().getUTCDate();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const clients = await airtableFetch<{ id: string; fields: { report_day?: number; month_number?: number; client_id?: string } }>("Clients", {
    filterByFormula: `AND({plan_status}="active",{report_day}>0)`,
    fields: ["report_day", "month_number", "client_id"],
    maxRecords: 200,
  });
  let enqueued = 0;
  for (const c of clients) {
    if (c.fields.report_day !== today) continue;
    const { data: existing } = await supabase
      .from("jobs")
      .select("id")
      .eq("sop_name", "report_generate")
      .eq("client_id", c.id)
      .gte("created_at", monthStart)
      .limit(1);
    if (existing && existing.length > 0) continue;
    await supabase.from("jobs").insert({
      sop_name: "report_generate",
      runner: "fly",
      status: "pending",
      client_id: c.id,
      payload: { client_id: c.id, month: c.fields.month_number ?? 1, source: "daily-backstop" },
    });
    enqueued++;
  }
  return { enqueued };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const isAuthed = (cronSecret && auth === `Bearer ${cronSecret}`) || isVercelCron;
  if (!isAuthed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activator, reports] = await Promise.all([
    runMonthlyActivator().catch((e) => ({ activated: 0, error: String(e) })),
    runReportScheduler().catch((e) => ({ enqueued: 0, error: String(e) })),
  ]);
  return NextResponse.json({ ok: true, activator, reports });
}
```

**Why:** If the Fly worker is down for >24h, `monthlyActivatorTick` and `reportSchedulerTick` both stop. Daily Vercel backstop ensures critical client-facing automation still fires.

**Verify:**
1. Push, wait for Vercel deploy
2. `curl -H "Authorization: Bearer $CRON_SECRET" https://seo-dashboard-teal-phi.vercel.app/api/cron/daily-backstop` → expect `{ok: true, activator: {activated: N}, reports: {enqueued: M}}`
3. Wait until 13:00 UTC, check Vercel logs for cron run

**Risk:** Idempotency relies on the same Supabase markers worker uses — if the worker is also up, the dashboard cron will simply find existing jobs and skip. Net no-op when both are running.

---

# PHASE B — P0 fixes

## B1 — Lock down `PUT /api/portal/content-schedule` (fixes F-501)

**File:** `dashboard/app/api/portal/content-schedule/route.ts`
**Lines:** 103-135

**Change — Before:**
```ts
export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { result_id?: string; new_date?: string };
  const { result_id, new_date } = body;
  if (!result_id || !new_date) {
    return NextResponse.json({ error: "result_id and new_date required" }, { status: 400 });
  }

  // Re-use PATCH logic but the caller is explicitly requesting a specific date reassignment
  // (PUT here handles the case where the calendar UI assigns the FIRST date after approval)
  const d = new Date(new_date + "T12:00:00Z");
  if (!isWeekday(d)) {
    return NextResponse.json({ error: "Cannot schedule on a weekend" }, { status: 400 });
  }

  try {
    await contentAirtablePatch("Results", result_id, {
      scheduled_publish_date: new_date,
    });
    return NextResponse.json({ ok: true, scheduled_date: new_date });
  } catch (err) {
    console.error("[PUT /api/portal/content-schedule] error:", err);
    return NextResponse.json({ error: "Failed to schedule" }, { status: 500 });
  }
}
```

**Change — After:** Either delete PUT entirely (if no UI calls it — verify with `grep -r "method: \"PUT\"" components/`) OR replace its body with an internal call to the same validation chain as PATCH. Recommended: **delete PUT and route initial-assignment through `getNextPublishDate()` server-side only** (which is already what `/api/portal/content-review/route.ts:40` does).

If verification proves PUT is unused, delete lines 103-135 entirely.

If PUT IS called from any UI (search `components/portal/PublishCalendar.tsx`), replace with:

```ts
// Identical validation to PATCH — past, weekday, occupied — for any client-driven date assignment.
export async function PUT(request: NextRequest) {
  return PATCH(request);
}
```

**Why:** PUT bypasses the global one-article-per-weekday lock. A logged-in client can call it to claim any date — past or already-taken — breaking the scheduler invariant.

**Verify:**
```bash
# As an authenticated portal session, attempt to PUT a date already in the occupied set.
# Expect 409 (conflict) or PUT to be 404/405 if deleted.
curl -X PUT "https://.../api/portal/content-schedule?token=$T" \
  -H "Content-Type: application/json" \
  -H "Cookie: portal_session=$SESSION" \
  -d '{"result_id":"rec...", "new_date":"2026-05-08"}'
```

**Risk:** If a UI somewhere calls PUT for a legitimate use case, deleting breaks it. Grep first.

---

## B2 — Quota-buffered title write must be atomic + error-safe (fixes F-505)

**File:** `dashboard/app/api/portal/titles/route.ts`
**Lines:** 309 (the `await contentAirtablePatch` inside the next_month branch)

**Change — Before:**
```ts
      await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, nextMonthFields);

      return NextResponse.json({
        ok: true,
        next_month: true,
        scheduled_for: nextMonth,
        message: `Your ${CONTENT_TYPE_CONFIG[typeName].label} slots for this month are full — this article has been queued for ${nextMonthLabel}.`,
      });
```

**Change — After:**
```ts
      try {
        await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, nextMonthFields);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 422 UNKNOWN_FIELD_NAME / INVALID_VALUE_FOR_COLUMN almost always means the
        // schema is missing scheduled_for_month or the next_month select option.
        // Surface the failure so the user sees an actionable error instead of a
        // false-success "queued for next month".
        console.error(`[portal/titles] next_month write failed for ${record_id}: ${msg}`);
        return NextResponse.json(
          {
            error: "schema_missing",
            message: "Couldn't queue this title for next month — please contact support so we can fix the issue.",
            detail: msg,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        next_month: true,
        scheduled_for: nextMonth,
        message: `Your ${CONTENT_TYPE_CONFIG[typeName].label} slots for this month are full — this article has been queued for ${nextMonthLabel}.`,
      });
```

**Why:** Without the try/catch, an Airtable schema mismatch (F-002, F-003) returns 500 from the unhandled throw and the caller never sees a clear cause. Worse, in some Airtable patch error modes (e.g., partial-update), title_status could flip while scheduled_for_month doesn't, leaving a half-written record.

**Verify:** A1 schema check is the real verification. After A1, this fix is preventive — won't trigger in normal operation.

**Risk:** None — this is pure error-path hardening.

---

# PHASE C — P1 fixes

## C1 — Make article approval atomic (fixes F-502)

**File:** `dashboard/app/api/portal/content-review/route.ts`
**Lines:** 28-48

**Change — Before:**
```ts
    if (body.type === "approve_article" && body.resultId) {
      // Mark approved
      await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
        portal_approval: "approved",
        portal_approved_at: new Date().toISOString(),
      });

      // Assign the next available publish date — the worker's daily publisherTick
      // will queue the actual publish job when that date arrives.
      let scheduledDate: string | null = null;
      try {
        scheduledDate = await getNextPublishDate();
        await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
          scheduled_publish_date: scheduledDate,
        });
      } catch (err) {
        console.error("Failed to assign publish date (non-fatal):", err);
      }

      return NextResponse.json({ ok: true, scheduled_date: scheduledDate });
    }
```

**Change — After:**
```ts
    if (body.type === "approve_article" && body.resultId) {
      // Compute publish date BEFORE writing approval so the two writes can be
      // collapsed into one atomic patch. If date computation fails, abort
      // entirely — better to fail loudly than ship a half-applied approval that
      // publisherTick will never act on.
      const scheduledDate = await getNextPublishDate();
      await contentAirtablePatch(RESULTS_TABLE, body.resultId, {
        portal_approval: "approved",
        portal_approved_at: new Date().toISOString(),
        scheduled_publish_date: scheduledDate,
      });
      return NextResponse.json({ ok: true, scheduled_date: scheduledDate });
    }
```

**Why:** Single PATCH = atomic in Airtable's per-record write model. Either the approval lands with a date or neither lands. Eliminates the silent-loss path where article is approved but unscheduled.

**Verify:**
1. Approve a test article via portal → confirm Airtable Results record has `portal_approval=approved` AND `scheduled_publish_date` set in the same record version
2. Simulate failure: temporarily revoke CONTENT_AIRTABLE_API_KEY → approval should 500, no partial state

**Risk:** If `getNextPublishDate()` raises (e.g., Airtable API outage during the read of occupied dates), approval now fails entirely instead of falling back to "approved without date". This is the desired behavior per F-502.

---

## C2 — Username collision check at intake (fixes F-101)

**File:** `dashboard/app/api/intake/route.ts`
**Lines:** 119-145 (after slugify, before fields construction)

**Change — Before:**
```ts
  const normalizedUrl = normalizeUrl(site_url as string);
  const client_id = slugify(company_name as string);
  const domain = deriveDomain(normalizedUrl);
  const gsc_property = domain ? `sc-domain:${domain}` : "";
  // Seed nav_pages with the homepage — audit_parent requires this to be non-empty
  const nav_pages = JSON.stringify([normalizedUrl]);

  // Idempotency — reject duplicate site URLs
  try {
    const existing = await airtableFetch<{ id: string }>("Clients", {
      filterByFormula: `{site_url} = "${normalizedUrl.replace(/\/$/, "")}"`,
      maxRecords: 1,
    });
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A client with this website URL already exists. Please contact us if this is unexpected." },
        { status: 409 }
      );
    }
  } catch {
    // Non-fatal — proceed if check fails
  }
```

**Change — After:**
```ts
  const normalizedUrl = normalizeUrl(site_url as string);
  const baseSlug = slugify(company_name as string);
  const domain = deriveDomain(normalizedUrl);
  const gsc_property = domain ? `sc-domain:${domain}` : "";
  const nav_pages = JSON.stringify([normalizedUrl]);

  // Idempotency — reject duplicate site URLs
  try {
    const existing = await airtableFetch<{ id: string }>("Clients", {
      filterByFormula: `{site_url} = "${normalizedUrl.replace(/\/$/, "")}"`,
      maxRecords: 1,
    });
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A client with this website URL already exists. Please contact us if this is unexpected." },
        { status: 409 }
      );
    }
  } catch {
    // Non-fatal — proceed if check fails
  }

  // Username uniqueness — slug collisions across companies (e.g. "Acme Inc" and "Acme, Inc.")
  // would create duplicate portal_username, breaking client lookup at login. Find a free slug
  // by appending -2, -3, …  Bounded retry to avoid infinite loop on an Airtable outage.
  let client_id = baseSlug;
  for (let suffix = 2; suffix < 50; suffix++) {
    try {
      const collision = await airtableFetch<{ id: string }>("Clients", {
        filterByFormula: `{portal_username} = "${client_id}"`,
        maxRecords: 1,
      });
      if (collision.length === 0) break;
      client_id = `${baseSlug}-${suffix}`;
    } catch {
      // If the check fails, fall through — duplicate possible but rare
      break;
    }
  }
```

**Why:** Without uniqueness, second client with the same slug cannot log in (lookup-by-username collides) and admin pages mix records.

**Verify:**
1. Create two test clients with similar names (`Acme Inc` and `Acme, Inc.`) → second should get `acme-inc-2` as portal_username
2. Both can log in with their respective passwords without cross-contamination

**Risk:** If Airtable is unavailable, falls through to potentially-duplicate slug. Acceptable given how rare this edge case is.

---

## C3 — Add FAQ quota enforcement to approvals (fixes F-301)

**File:** `dashboard/app/api/approvals/route.ts`
**Lines:** 16-19

**Change — Before:**
```ts
const TYPE_QUOTAS: Record<string, keyof PackageDeliverables> = {
  "Internal Link":      "internal_links",
  "Internal Links":     "internal_links",
};
```

**Change — After:**
```ts
const TYPE_QUOTAS: Record<string, keyof PackageDeliverables> = {
  "Internal Link":      "internal_links",
  "Internal Links":     "internal_links",
  "FAQ":                "faq_sections",
};
```

**Why:** PACKAGES promises 1/3/6 FAQs per month per tier. Without enforcement, audits surface unlimited FAQ approvals → agency takes on more work than billed.

**Verify:**
1. Find a Starter-tier test client with at least 2 pending FAQ Changes
2. Approve one → succeeds
3. Approve a second → expect 409 with `quota_reached: true` and `limit: 1`

**Risk:** Existing clients with already-approved-this-month FAQs > tier limit will get future approvals blocked. Confirm with Josh whether that's the desired behavior or whether grandfather logic is needed.

---

## C4 — Activity feed: log skipped titles + use publish date for published events (fixes F-503, F-504)

**Step 1 — Add `skipped_at` write on title skip**

**File:** `dashboard/app/api/portal/titles/route.ts`
**Lines:** 458 (DELETE handler body)

**Change — Before:**
```ts
  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { title_status: "skipped" });

  return NextResponse.json({ ok: true });
```

**Change — After:**
```ts
  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, {
    title_status: "skipped",
    skipped_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
```

**Schema dependency:** Add a `skipped_at` field (type: dateTime, ISO format) to `Content Jobs` table in the content base. See A1.

**Step 2 — Add a `published_at` write on publisherTick (worker side)**

**File:** `worker/src/index.ts`
**Lines:** Inside `publisherTick()` function (~line 337+) — find where `title_status: "published"` is written and add `published_at: new Date().toISOString()` to the same patch.

(Read the function first to get exact line; I haven't read it in this QA pass, so verify the exact location.)

**Step 3 — Update activity feed to consume both new fields**

**File:** `dashboard/app/portal/[token]/activity/page.tsx`
**Lines:** 152-162

**Change — Before:**
```tsx
 // Content events from Content Jobs — emit one entry per lifecycle event
 for (const job of contentJobs) {
 const blogTitle = job.fields["Blog Title"] || "Untitled";
 if (job.fields.proposed_at) {
 entries.push({ kind: "content", date: job.fields.proposed_at, title: blogTitle, event: "proposed" });
 }
 if (job.fields.approved_at) {
 const event = job.fields.title_status === "published" ? "published" : "approved";
 entries.push({ kind: "content", date: job.fields.approved_at, title: blogTitle, event });
 }
 }
```

**Change — After:**
```tsx
 // Content events from Content Jobs — emit one entry per lifecycle event
 for (const job of contentJobs) {
 const blogTitle = job.fields["Blog Title"] || "Untitled";
 if (job.fields.proposed_at) {
 entries.push({ kind: "content", date: job.fields.proposed_at, title: blogTitle, event: "proposed" });
 }
 if (job.fields.approved_at) {
 entries.push({ kind: "content", date: job.fields.approved_at, title: blogTitle, event: "approved" });
 }
 if (job.fields.skipped_at) {
 entries.push({ kind: "content", date: job.fields.skipped_at, title: blogTitle, event: "skipped" });
 }
 if (job.fields.published_at) {
 entries.push({ kind: "content", date: job.fields.published_at, title: blogTitle, event: "published" });
 }
 }
```

Also update the `ChangelogEntry` type at line 30:
```ts
 | { kind: "content"; date: string; title: string; event: "proposed" | "approved" | "skipped" | "completed" | "published" };
```

And update the `getContentJobsForClient` return type in `lib/content.ts` to include `skipped_at` and `published_at` fields. And update the `contentEventLabel` and `contentEventColor` maps near line 285-296 to include `skipped`.

**Why:** Skipped titles disappear from the changelog → clients can't audit decisions. Published events show approval date instead of publish date → calendar mismatch.

**Verify:**
1. Skip a title via portal → activity feed shows "Title Skipped" with the correct date
2. Wait for publisherTick to publish a scheduled article → activity feed shows "Article Published" with the publish date, not the approval date

**Risk:** Adds two new fields to the Content Jobs schema (skipped_at, published_at). Both are optional; existing records with NULL won't emit those events.

---

## C5 — Fix Reddit count source so it doesn't always show 0/N (fixes F-302)

User has marked Reddit out of scope, so this is a UX hide-rather-than-fix:

**File:** `dashboard/components/portal/MonthlyProgress.tsx`
**Lines:** 156, 239-242, 339-342

**Recommendation:** Either:
1. **Wire the count to Engain mentions** (out of scope per user direction) — defer
2. **Hide the Reddit row when count is 0** — less ambiguous than perpetual 0/N

Suggested defer: leave as-is for now since user has Reddit out-of-scope. Add this to a follow-up backlog under a Reddit/Engain epic.

**Action:** No code change in this fix-pack. Document in findings as known UX issue.

---

## C6 — Document/decide month_number rollover behavior (fixes F-902, F-903)

**Issue:** `monthAdvanceTick` only bumps clients in `plan_status="active"` — clients stuck in `month1_audit_complete` never roll over. Also: calendar-month vs anniversary semantics are unclear.

**Question for Josh** — pick one before fixing:
1. Should `month1_audit_complete` clients also have month_number incremented? Or do they sit at month 0/1 until manually transitioned to active?
2. Should month_number rollover be calendar-month (everyone bumps on the 1st) or anniversary (each client bumps on their intake date)?

**No code change until decision made.** Add as an explicit Q to be answered in the hand-off conversation.

If calendar + include audit-complete: change worker line 1094 filter to `OR({plan_status}="active",{plan_status}="month1_audit_complete")`.

If anniversary: substantial rewrite — track `intake_date` and compute month_number per-client per-day.

---

## C7 — Address triple-trigger n8n webhook (fixes F-506)

**Issue:** Three paths fire the n8n webhook:
1. `/api/content-approval` (used by `useArticleActions.ts`)
2. `/api/portal/titles` PATCH (used by `titles/page.tsx`)
3. Airtable `status_change` automation on `Status="Queued"`

**Question for Josh** — pick the source of truth:
- (a) Keep portal endpoints + delete Airtable automation
- (b) Keep Airtable automation + remove webhook fires from portal endpoints (most robust, but adds Airtable→n8n latency)
- (c) Add idempotency token to webhook payload so n8n can dedupe (least disruptive, but assumes n8n cooperates)

**Recommended:** (b) — Airtable automation has been the most reliable trigger historically per memory. Removes two redundant code paths.

**No code change until decision made.** When (b) is chosen, the changes are:

**File:** `dashboard/app/api/portal/titles/route.ts` lines 363-419
**Change:** delete the entire `// Route to the right job processor on approval` block. The Status="Queued" patch on line 328 is enough — Airtable automation will fire the webhook.

**File:** `dashboard/app/api/content-approval/route.ts` lines 49-76
**Change:** delete the webhook fire; keep the Airtable patch.

---

# PHASE D — P2 fixes

## D1 — Fix guide page quotas (fixes F-102, F-103, F-104)

**File:** `dashboard/app/portal/[token]/guide/page.tsx`
**Lines:** 415-418, 497-506

**Change A (lines 415-418) — Before:**
```tsx
 <p>
 To avoid flooding the queue, the system will pause title generation if you have 5 or more
 titles already waiting for approval.
 </p>
```

**Change A — After:**
```tsx
 <p>
 To avoid flooding the queue, the system pauses title generation when you have a buffer of
 pending titles already waiting for approval (6 for Starter, 10 for Growth, 16 for Authority).
 </p>
```

**Change B (lines 497-506) — Before:**
```tsx
 {[
 ["Starter", "2 refreshes per month"],
 ["Growth", "4 refreshes per month"],
 ["Authority", "8 refreshes per month"],
 ].map(([plan, desc]) => (
```

**Change B — After:**
```tsx
 {[
 ["Starter", "2 refreshes per month"],
 ["Growth", "6 refreshes per month"],
 ["Authority", "12 refreshes per month"],
 ].map(([plan, desc]) => (
```

Optional improvement: drive these from `lib/packages.ts` to prevent future drift:
```tsx
import { PACKAGES } from "@/lib/packages";
// ...
{(["starter", "growth", "authority"] as const).map((plan) => (
  <div key={plan} className="grid grid-cols-[80px_1fr] gap-2">
    <span className="text-[12px] font-medium text-slate-700">{PACKAGE_LABELS[plan]}</span>
    <span className="text-[12px] text-slate-500">{PACKAGES[plan].content_refreshes} refreshes per month</span>
  </div>
))}
```

**Why:** Direct mis-promise to clients. Growth/Authority refreshes count was wrong by 2x and 1.5x.

**Verify:** Reload `/portal/{token}/guide` → confirm correct numbers.

**Risk:** None — pure docstring fix.

---

## D2 — Stop overwriting plaintext password on client-initiated change (fixes F-005)

**File:** `dashboard/app/api/portal/settings/change-password/route.ts`
**Lines:** 40-43

**Change — Before:**
```ts
  await airtablePatch("Clients", client.id, {
    portal_password_hash: newHash,
    portal_password: new_password,
  });
```

**Change — After:**
```ts
  // Client-initiated password change — never persist the new plaintext.
  // The hash is the only artifact we keep. Admin-reference plaintext only
  // exists for the auto-generated initial password (intake/admin create).
  await airtablePatch("Clients", client.id, {
    portal_password_hash: newHash,
    portal_password: "",
  });
```

**Why:** When a user explicitly changes their password (e.g., for security after sharing it with a contractor), the new plaintext should not be visible in Airtable to the agency. Set to empty string to clear the previously-stored auto-generated value.

**Verify:**
1. Change a test client's password via portal settings
2. Inspect their Airtable record — `portal_password` field is empty, `portal_password_hash` is updated
3. Login with new password works

**Risk:** Admins can no longer fish out client passwords for clients who changed their own. They'll need to issue a reset (via password-reset flow if it exists, or admin manual reset).

**Optional follow-up:** Build a portal-side "request password reset" flow if not already present.

---

## D3 — Update deliverables page to show MTD progress (fixes F-901)

**File:** `dashboard/app/portal/[token]/deliverables/page.tsx`
**Lines:** 174-218 (the deliverable rendering section)

**Approach:** Extract the actuals-fetching logic from `MonthlyProgress.tsx:79-158` into a shared `lib/deliverables.ts` helper, then use it in both places.

**Step 1 — Extract helper:**

Create `dashboard/lib/deliverables.ts`:
```ts
import { airtableFetch, contentAirtableFetch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";

export type DeliverableActuals = {
  articles_standard: number;
  articles_longform: number;
  faq_sections: number;
  content_refreshes: number;
  internal_links: number;
  reddit_comments: number;
};

export function startOfMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function fetchDeliverableActuals(
  clientRecordId: string,
  clientSlug: string,
  companyName: string,
  monthStart: string = startOfMonthStr()
): Promise<DeliverableActuals> {
  // Move the body of fetchActuals from MonthlyProgress.tsx here verbatim.
  // ... (paste from MonthlyProgress.tsx:79-158)
}
```

**Step 2 — Replace `MonthlyProgress.tsx` `fetchActuals` with a call to the helper.**

**Step 3 — Update `deliverables/page.tsx`:**

```tsx
// Add at top:
import { fetchDeliverableActuals, startOfMonthStr } from "@/lib/deliverables";

// In the page component, before render:
const actuals = await fetchDeliverableActuals(
  client.id,
  client.fields.client_id || "",
  client.fields.company_name || "",
);

// In the deliverable row map (~line 188-214), wrap the count display:
const used = actuals[key] ?? 0;
const remaining = Math.max(0, count - used);
// Replace the "{count}" display with progress: e.g.
// <div>{used} / {count}</div> with a progress bar
```

**Why:** Two pages (sidebar MonthlyProgress + deliverables page) were showing inconsistent info. Centralizing the count in `lib/deliverables.ts` and showing MTD on /deliverables aligns them.

**Verify:** Same client viewed at `/portal/{token}` (sidebar) and `/portal/{token}/deliverables` should show identical numbers.

**Risk:** Refactor — verify both pages still render with the new shared helper.

---

## D4 — Escape company name in `getContentClientId` filter (fixes F-507)

**File:** `dashboard/app/api/portal/titles/route.ts`
**Lines:** 18-24

**Change — Before:**
```ts
async function getContentClientId(companyName: string): Promise<string | null> {
  const records = await contentAirtableFetch<{ id: string }>(
    CONTENT_CLIENTS_TABLE,
    { filterByFormula: `{Client Name}="${companyName}"` }
  );
  return records[0]?.id ?? null;
}
```

**Change — After:**
```ts
async function getContentClientId(companyName: string): Promise<string | null> {
  const escaped = companyName.replace(/"/g, '\\"');
  const records = await contentAirtableFetch<{ id: string }>(
    CONTENT_CLIENTS_TABLE,
    { filterByFormula: `{Client Name}="${escaped}"` }
  );
  return records[0]?.id ?? null;
}
```

**Why:** Unescaped quotes in company names cause INVALID_FILTER_BY_FORMULA → returns null → next branch creates a duplicate Content client record.

**Verify:** Run intake with a company named like `Foo "Best" Bar` → the auto-create flow correctly looks up existing record on second call.

**Risk:** None — defensive escape.

---

## D5 — Defaulting nuance: substring lookup risk (fixes F-508)

**File:** `dashboard/lib/content.ts` and `dashboard/app/api/portal/titles/route.ts:84-88`

**Approach:** The `FIND` substring search is the existing working pattern (per memory). Switching to exact-match against the lookup field requires a different formula approach because the lookup is an array.

**Recommended:** Use a stricter match by wrapping with comma boundaries:
```ts
filterByFormula: `AND(FIND(",${escaped},",","&ARRAYJOIN({Client Name (from Client ID)},",")&","), …)`
```

This converts `"Acme,Acme Co"` into `",Acme,Acme Co,"` and searches for `",Acme,"` — the leading and trailing commas force exact-match semantics.

Apply the same change anywhere the FIND pattern is used:
- `app/api/portal/titles/route.ts:85, 266, 284, 354`
- `lib/content.ts:211` (and in `getScheduledArticlesForClient`)
- `lib/content-schedule.ts:102`
- `components/portal/MonthlyProgress.tsx:135`

**Why:** Prevents cross-client data leak when one company's name is a substring of another's.

**Verify:** Create two test clients "Acme" and "Acme Co" → titles list for "Acme" must show only Acme records, not Acme Co.

**Risk:** Subtle change to formula — test thoroughly. Edge case: company names that contain commas would need additional handling.

---

## D6 — Indexing API failure surfacing (fixes F-801)

**File:** `dashboard/app/api/approvals/route.ts`
**Lines:** 201-210

**Change — Before:**
```ts
      const pageUrl = changeFields.page_url as string | undefined;
      if (pageUrl) {
        submitUrlToIndexingAPI(pageUrl).then((result) => {
          const status = "error" in result ? "failed" : "submitted";
          airtablePatch("Changes", recordId, {
            indexing_status: status,
            indexing_submitted_at: new Date().toISOString(),
          }).catch(() => {});
        }).catch(() => {});
      }
```

**Change — After:**
```ts
      const pageUrl = changeFields.page_url as string | undefined;
      if (pageUrl) {
        submitUrlToIndexingAPI(pageUrl).then((result) => {
          const status = "error" in result ? "failed" : "submitted";
          const errorMsg = "error" in result ? String((result as { error: unknown }).error).slice(0, 500) : null;
          airtablePatch("Changes", recordId, {
            indexing_status: status,
            indexing_submitted_at: new Date().toISOString(),
            indexing_error: errorMsg,
          }).catch((e) => {
            console.error(`[approvals] indexing-status patch failed for ${recordId}:`, e);
          });
        }).catch((e) => {
          console.error(`[approvals] submitUrlToIndexingAPI threw for ${pageUrl}:`, e);
        });
      }
```

**Schema dependency:** Add `indexing_error` field (multilineText) to `Changes` table — see A1.

**Why:** Failures were silently swallowed. With the error logged, operators can see Indexing API rejections (rate-limit, quota, etc.) in Vercel logs and the per-record error context.

**Verify:** Run a portal approval that triggers an Indexing API call against a URL Google rejects → check `Changes.indexing_error` is populated.

**Risk:** New schema field — see A1.

---

# PHASE E — P3 polish

## E1 — Idempotent intake on www. variants (F-106)

**File:** `dashboard/app/api/intake/route.ts:127-136`
**Change:** Normalize site_url more aggressively before dedup — strip `www.`, lowercase, strip trailing slash.

```ts
function normalizeForDedup(url: string): string {
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "https://").replace(/\/$/, "");
}
// Then in the filter:
const dedupKey = normalizeForDedup(normalizedUrl);
const existing = await airtableFetch<{ id: string }>("Clients", {
  filterByFormula: `LOWER({site_url}) = "${dedupKey}"`,  // requires LOWER() in Airtable formula
  maxRecords: 1,
});
```

**Risk:** `LOWER()` is supported in Airtable formulas; trailing-slash and `www` variants in existing data may not match. Audit existing site_url field values first.

---

## E2 — Add "Generate internal links now" portal button (F-401)

Optional UX. Add a button on `/portal/[token]/internal-links` that POSTs to `/api/audit/internal-links/generate-batch` with the right auth scope. Requires routing portal-auth header to the crawler-service-token check, OR exposing a separate portal endpoint that internally calls the generate-batch logic.

Defer until prioritized.

---

## E3 — Add portal "undo" UI for non-implemented decisions (F-304)

`lib/changes.ts:108-156` already exists. Add an "Undo" button to `ApprovalMasterDetail` for decided items where `execution_status` is null or `pending`.

Defer until prioritized.

---

## E4 — Reduce auth check latency (F-1002 verification)

E2E curl probes — not a fix, just a verification suite to add to a future test script. Document as a follow-up.

---

# Hand-off notes

**Pre-flight checklist for the implementer:**
1. Confirm Airtable schema (A1) before starting any S5 (content) fixes — F-002, F-003, F-004 are blockers
2. Read `dashboard/AGENTS.md` and `dashboard/CLAUDE.md` — Next.js 16 has breaking changes from training data
3. Worker changes require `fly deploy` from `~/Desktop/Claude/worker/`
4. Dashboard changes require `git push` (Vercel auto-deploys)
5. Don't `git commit` unless explicitly asked
6. After every dashboard fix: `pnpm typecheck` (or `npm run typecheck`) in `~/Desktop/Claude/dashboard/` — Next.js 16 router type generation breaks easily

**Deferred decisions for Josh** (these block C6 and C7):
- C6: month_number rollover semantics — calendar vs anniversary; include audit-complete clients?
- C7: which path is canonical for n8n webhook firing — keep Airtable automation only?

**Out of scope reminder:** Reddit/Engain features and WordPress-implementation SOPs were not QA'd. F-302 (Reddit count broken) is documented but the fix is deferred under user direction.

**E2E walks not run:** All 8 walks in `qa-findings.md` are UNVERIFIED. The implementer should pick one walk per fix-surface they touch and run it before declaring the fix done.
