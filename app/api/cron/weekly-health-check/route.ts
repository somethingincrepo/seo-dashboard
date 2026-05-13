import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { airtableFetch } from "@/lib/airtable";
import { verifyBearer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Returns ISO 8601 timestamp of the most recent Monday 00:00:00 UTC.
// Mirrors getWeekStart() in worker/src/index.ts so the dashboard cron and the
// Fly worker tick share the same idempotency boundary.
function getWeekStartISO(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Sun→7, Mon→1 … Sat→6
  d.setUTCDate(d.getUTCDate() - dayOfWeek + 1);
  return d.toISOString();
}

type ClientRecord = {
  id: string;
  fields: {
    company_name?: string;
    plan_status?: string;
    portal_token?: string;
    package?: string;
  };
};

type HealthCheckResult = {
  ok: true;
  week_start: string;
  clients_checked: number;
  refresh_scheduler_inserted: boolean;
  internal_links_jobs_inserted: number;
  faq_jobs_inserted: number;
  reddit_scan_jobs_inserted: number;
  page_creation_jobs_inserted: number;
  per_client: Array<{
    client_id: string;
    company_name: string;
    needed_internal_links_job: boolean;
    inserted_internal_links_job: boolean;
    skip_reason?: string;
  }>;
};

export async function GET(request: NextRequest) {
  const adminPass = process.env.ADMIN_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  const isAdmin = adminPass && verifyBearer(request, adminPass);
  const isCronSecret = cronSecret && verifyBearer(request, cronSecret);
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (!isAdmin && !isCronSecret && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const weekStart = getWeekStartISO();

  // ── Step 1: ensure a refresh_scheduler job exists for this ISO week ──────
  // The worker enqueues ONE global refresh_scheduler job per week (no client_id);
  // the SOP iterates all clients. We check for any such job created since
  // weekStart and only insert one if none exists. This keeps us idempotent
  // with refreshSchedulerTick in worker/src/index.ts.
  let refreshInserted = false;
  {
    const { data: existing, error } = await supabase
      .from("jobs")
      .select("id")
      .eq("sop_name", "refresh_scheduler")
      .gte("created_at", weekStart)
      .limit(1);
    if (error) throw new Error(`refresh_scheduler lookup failed: ${error.message}`);
    if (!existing || existing.length === 0) {
      const { error: insErr } = await supabase
        .from("jobs")
        .insert({
          sop_name: "refresh_scheduler",
          runner: "fly",
          status: "pending",
          payload: { weekly_run: true, source: "weekly-health-check" },
        });
      if (insErr) {
        console.error("[weekly-health-check] refresh_scheduler insert failed:", insErr.message);
      } else {
        refreshInserted = true;
        console.log("[weekly-health-check] inserted weekly refresh_scheduler job");
      }
    }
  }

  // ── Step 2: per-client audit_internal_links backstop ─────────────────────
  // monthlyChangesSchedulerTick inserts one audit_internal_links job per active
  // client per ISO week. For each client missing one, insert it here.
  let clients: ClientRecord[] = [];
  try {
    clients = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: `AND(OR({plan_status}="active",{plan_status}="month1_audit",{plan_status}="month1_audit_complete"),{portal_token}!="")`,
      fields: ["company_name", "plan_status", "portal_token", "package"],
      maxRecords: 200,
    });
  } catch (e) {
    console.error("[weekly-health-check] clients fetch failed:", e);
    return NextResponse.json(
      { error: "clients fetch failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const perClient: HealthCheckResult["per_client"] = [];
  let internalLinksInserted = 0;
  let faqJobsInserted = 0;
  let redditScanJobsInserted = 0;
  let pageCreationJobsInserted = 0;

  for (const client of clients) {
    const companyName = client.fields.company_name ?? client.id;
    if (!client.fields.portal_token) {
      perClient.push({
        client_id: client.id,
        company_name: companyName,
        needed_internal_links_job: false,
        inserted_internal_links_job: false,
        skip_reason: "missing portal_token",
      });
      continue;
    }

    const { data: existing, error } = await supabase
      .from("jobs")
      .select("id")
      .eq("sop_name", "audit_internal_links")
      .eq("client_id", client.id)
      .gte("created_at", weekStart)
      .limit(1);
    if (error) {
      console.error(`[weekly-health-check] audit_internal_links lookup failed for ${client.id}:`, error.message);
      perClient.push({
        client_id: client.id,
        company_name: companyName,
        needed_internal_links_job: false,
        inserted_internal_links_job: false,
        skip_reason: `supabase lookup error: ${error.message}`,
      });
      continue;
    }

    if (existing && existing.length > 0) {
      perClient.push({
        client_id: client.id,
        company_name: companyName,
        needed_internal_links_job: false,
        inserted_internal_links_job: false,
      });
      continue;
    }

    const { error: insErr } = await supabase.from("jobs").insert({
      sop_name: "audit_internal_links",
      runner: "fly",
      status: "pending",
      client_id: client.id,
      payload: { client_id: client.id, source: "weekly-health-check" },
    });
    if (insErr) {
      console.error(`[weekly-health-check] audit_internal_links insert failed for ${client.id}:`, insErr.message);
      perClient.push({
        client_id: client.id,
        company_name: companyName,
        needed_internal_links_job: true,
        inserted_internal_links_job: false,
        skip_reason: `insert error: ${insErr.message}`,
      });
    } else {
      internalLinksInserted += 1;
      perClient.push({
        client_id: client.id,
        company_name: companyName,
        needed_internal_links_job: true,
        inserted_internal_links_job: true,
      });
    }
  }

  // ── Step 3: monthly FAQ backstop ─────────────────────────────────────────
  // On the first Monday of each calendar month (UTC date 1–7), ensure every
  // active client has a generate_faq_sections job for the current month.
  // This covers clients who missed the post-audit trigger (e.g. re-audits that
  // don't re-fire the diagnose endpoint) and provides the recurring monthly run.
  const now = new Date();
  const isFirstWeekOfMonth = now.getUTCDate() <= 7;

  if (isFirstWeekOfMonth) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    for (const client of clients) {
      if (!client.fields.portal_token) continue;
      const { data: existingFaq, error: faqErr } = await supabase
        .from("jobs")
        .select("id")
        .eq("sop_name", "generate_faq_sections")
        .eq("client_id", client.id)
        .gte("created_at", monthStart)
        .limit(1);
      if (faqErr) {
        console.error(`[weekly-health-check] generate_faq_sections lookup failed for ${client.id}:`, faqErr.message);
        continue;
      }
      if (existingFaq && existingFaq.length > 0) continue;
      const { error: insErr } = await supabase.from("jobs").insert({
        sop_name: "generate_faq_sections",
        runner: "fly",
        status: "pending",
        client_id: client.id,
        payload: { client_id: client.id, source: "weekly-health-check-monthly-faq" },
      });
      if (insErr) {
        console.error(`[weekly-health-check] generate_faq_sections insert failed for ${client.id}:`, insErr.message);
      } else {
        faqJobsInserted += 1;
      }
    }
  }

  // ── Step 4: per-client weekly Reddit opportunity scan ────────────────────
  // One scan_reddit_opportunities job per active client per ISO week.
  // The Fly worker runs it via DETERMINISTIC_SOPS → POST /api/cron/reddit-opportunity-scan.
  // The job payload carries the client's package tier so the endpoint can
  // apply the correct weekly reddit_comments quota from packages.ts.
  for (const client of clients) {
    if (!client.fields.portal_token) continue;
    const { data: existingReddit, error: redditErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("sop_name", "scan_reddit_opportunities")
      .eq("client_id", client.id)
      .gte("created_at", weekStart)
      .limit(1);
    if (redditErr) {
      console.error(`[weekly-health-check] scan_reddit_opportunities lookup failed for ${client.id}:`, redditErr.message);
      continue;
    }
    if (existingReddit && existingReddit.length > 0) continue;
    const { error: insErr } = await supabase.from("jobs").insert({
      sop_name: "scan_reddit_opportunities",
      runner: "fly",
      status: "pending",
      client_id: client.id,
      payload: { client_id: client.id, package: client.fields.package ?? "starter", source: "weekly-health-check" },
    });
    if (insErr) {
      console.error(`[weekly-health-check] scan_reddit_opportunities insert failed for ${client.id}:`, insErr.message);
    } else {
      redditScanJobsInserted += 1;
    }
  }

  // ── Step 5: per-client weekly page-creation backstop ────────────────────
  // pageCreationSchedulerTick in the Fly worker runs a global job weekly, but
  // individual clients can be skipped if the SOP fails mid-loop. Insert a
  // per-client job for any client missing one this week (idempotent with the
  // worker tick — page_creation_scheduler's monthly cap prevents overrun).
  for (const client of clients) {
    if (!client.fields.portal_token) continue;
    const { data: existingPcs, error: pcsErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("sop_name", "page_creation_scheduler")
      .eq("client_id", client.id)
      .gte("created_at", weekStart)
      .limit(1);
    if (pcsErr) {
      console.error(`[weekly-health-check] page_creation_scheduler lookup failed for ${client.id}:`, pcsErr.message);
      continue;
    }
    if (existingPcs && existingPcs.length > 0) continue;
    const { error: insErr } = await supabase.from("jobs").insert({
      sop_name: "page_creation_scheduler",
      runner: "fly",
      status: "pending",
      client_id: client.id,
      payload: { client_id: client.id, source: "weekly-health-check" },
    });
    if (insErr) {
      console.error(`[weekly-health-check] page_creation_scheduler insert failed for ${client.id}:`, insErr.message);
    } else {
      pageCreationJobsInserted += 1;
    }
  }

  console.log(
    `[weekly-health-check] week=${weekStart} clients=${clients.length} ` +
      `refresh_scheduler_inserted=${refreshInserted} ` +
      `internal_links_jobs_inserted=${internalLinksInserted} ` +
      `faq_jobs_inserted=${faqJobsInserted} ` +
      `reddit_scan_jobs_inserted=${redditScanJobsInserted} ` +
      `page_creation_jobs_inserted=${pageCreationJobsInserted}`,
  );

  const result: HealthCheckResult = {
    ok: true,
    week_start: weekStart,
    clients_checked: clients.length,
    refresh_scheduler_inserted: refreshInserted,
    internal_links_jobs_inserted: internalLinksInserted,
    faq_jobs_inserted: faqJobsInserted,
    reddit_scan_jobs_inserted: redditScanJobsInserted,
    page_creation_jobs_inserted: pageCreationJobsInserted,
    per_client: perClient,
  };
  return NextResponse.json(result);
}
