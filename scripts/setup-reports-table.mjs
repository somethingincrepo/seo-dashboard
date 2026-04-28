#!/usr/bin/env node
/**
 * Sets up the Supabase reports table and inserts test data.
 *
 * Usage:
 *   node scripts/setup-reports-table.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * OR set them in the environment directly.
 *
 * The script:
 * 1. Creates the reports table via Supabase Management API (if you have a PAT)
 *    OR prints SQL for you to run in the Supabase dashboard.
 * 2. Inserts rich test data so you can see the full report UI immediately.
 */

import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// Resolve @supabase/supabase-js from dashboard's node_modules (script lives in dashboard/scripts/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(__dirname, "..");
const require = createRequire(path.join(dashboardPath, "package.json"));
const { createClient } = require("@supabase/supabase-js");

// ── Load env from .env.local ──────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(
      new URL("../.env.local", import.meta.url).pathname,
      "utf8"
    ).split("\n");
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in dashboard/.env.local or environment).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Check existing jobs to pick a real client_id ─────────────────────────────
async function getRealClientId() {
  const { data } = await supabase
    .from("jobs")
    .select("client_id")
    .not("client_id", "is", null)
    .limit(10);

  const ids = [...new Set((data ?? []).map((r) => r.client_id).filter(Boolean))];
  if (ids.length === 0) {
    console.log("⚠  No jobs with client_id found. Using placeholder — update manually.");
    return "REPLACE_WITH_AIRTABLE_CLIENT_RECORD_ID";
  }
  console.log(`Found ${ids.length} unique client IDs in jobs table.`);
  ids.forEach((id, i) => console.log(`  [${i}] ${id}`));
  console.log(`Using: ${ids[0]}`);
  return ids[0];
}

// ── Test data ────────────────────────────────────────────────────────────────
function buildTestRow(clientId) {
  return {
    client_id: clientId,
    month: 3,
    report_month_label: "April 2026",
    report_generated_at: new Date().toISOString(),

    changes_made: 18,
    changes_by_category: { Technical: 5, "On-Page": 7, Content: 3, "AI-GEO": 3 },
    notable_changes: [
      "Rewrote meta titles on 7 high-impression pages in position 6–14",
      "Added LocalBusiness + FAQPage schema to homepage and 3 service pages",
      "Fixed 12 missing alt text fields on hero images",
      "Injected 3 new FAQ sections targeting featured snippet queries",
      "Added 14 internal links connecting pillar pages to supporting content",
    ].join("\n"),
    skipped_count: 4,

    pages_optimized: [
      { page: "/services/cloud-migration", before_title: "Cloud Migration | Acme", after_title: "Cloud Migration Services for SMBs | Acme", before_h1: "Cloud Migration", after_h1: "Cloud Migration Services for Growing Businesses" },
      { page: "/services/data-backup", before_title: "Data Backup Solutions", after_title: "Automated Data Backup & Recovery Solutions | Acme", before_h1: "Data Backup", after_h1: "Enterprise Data Backup Solutions" },
      { page: "/pricing", before_title: "Pricing", after_title: "IT Managed Services Pricing — Acme", before_h1: "Pricing", after_h1: "Simple, Transparent IT Pricing" },
    ],
    schema_types_added: ["LocalBusiness", "FAQPage", "BreadcrumbList"],
    internal_links_added: 14,
    approval_queue_status: { approved: 14, live: 14, pending: 6, skipped: 4, pending_14days: 2 },

    gsc_clicks_this: 1840, gsc_clicks_prior: 1623, gsc_clicks_delta: 217, gsc_clicks_pct: "+13%",
    gsc_impressions_this: 42100, gsc_impressions_prior: 38800, gsc_impressions_delta: 3300,
    gsc_avg_position_this: 8.2, gsc_avg_position_prior: 9.1, gsc_avg_position_delta: -0.9,
    gsc_ctr_this: 0.0437, gsc_ctr_prior: 0.0418,
    gsc_3month_trend: [
      { month_label: "Feb 2026", clicks: 1401, impressions: 34200, avg_position: 10.3 },
      { month_label: "Mar 2026", clicks: 1623, impressions: 38800, avg_position: 9.1 },
      { month_label: "Apr 2026", clicks: 1840, impressions: 42100, avg_position: 8.2 },
    ],
    top_ranking_gains: [
      { keyword: "managed IT services small business", prior_position: 14.2, current_position: 7.8, change: 6.4 },
      { keyword: "cloud backup solutions", prior_position: 18.1, current_position: 11.3, change: 6.8 },
      { keyword: "IT support Chicago", prior_position: 9.4, current_position: 4.1, change: 5.3 },
      { keyword: "network monitoring service", prior_position: 22.0, current_position: 16.5, change: 5.5 },
      { keyword: "cybersecurity for small business", prior_position: 31.0, current_position: 26.2, change: 4.8 },
    ],
    top_ranking_losses: [
      { keyword: "enterprise data migration", prior_position: 12.1, current_position: 16.8, change: -4.7 },
      { keyword: "IT consulting firms", prior_position: 8.3, current_position: 11.2, change: -2.9 },
    ],
    new_top_20_keywords: [
      { keyword: "managed security services", position: 18.4 },
      { keyword: "remote IT support", position: 14.9 },
      { keyword: "server maintenance contract", position: 19.1 },
    ],
    top_1_3_keywords: [
      { keyword: "IT support Chicago", position: 4.1 },
      { keyword: "managed IT services small business", position: 7.8 },
    ],
    top_pages_growth: [
      { page: "/services/cloud-migration", clicks_this: 312, clicks_prior: 241, delta: 71 },
      { page: "/blog/cybersecurity-checklist", clicks_this: 189, clicks_prior: 134, delta: 55 },
      { page: "/services/it-support", clicks_this: 428, clicks_prior: 381, delta: 47 },
      { page: "/blog/remote-work-security", clicks_this: 143, clicks_prior: 104, delta: 39 },
      { page: "/pricing", clicks_this: 201, clicks_prior: 168, delta: 33 },
    ],
    top_pages_loss: [
      { page: "/services/data-migration", clicks_this: 87, clicks_prior: 124, delta: -37 },
      { page: "/blog/windows-11-upgrade", clicks_this: 44, clicks_prior: 71, delta: -27 },
    ],

    ga4_sessions_this: 3840, ga4_sessions_prior: 3390, ga4_sessions_delta: 450,
    ga4_users_this: 2910, ga4_users_prior: 2620, ga4_users_delta: 290,
    ga4_ai_sessions_this: 47, ga4_ai_sessions_prior: 31, ga4_ai_sessions_delta: 16,
    ga4_ai_by_source: [
      { source: "chat.openai.com", sessions_this: 23, sessions_prior: 14 },
      { source: "perplexity.ai", sessions_this: 18, sessions_prior: 12 },
      { source: "gemini.google.com", sessions_this: 6, sessions_prior: 5 },
    ],

    articles_published: [
      { title: "7 Signs Your Small Business Needs Managed IT Services", keyword: "managed IT services small business", url: "/blog/signs-you-need-managed-it", ranking_position: null },
      { title: "Cloud Backup vs. On-Premise: What SMBs Need to Know", keyword: "cloud backup solutions", url: "/blog/cloud-backup-vs-on-premise", ranking_position: null },
      { title: "Cybersecurity Checklist for Remote Teams in 2026", keyword: "cybersecurity remote work", url: "/blog/cybersecurity-checklist-remote", ranking_position: 18 },
    ],
    articles_now_ranking: [
      { title: "How to Choose an IT Support Provider", keyword: "IT support Chicago", position: 7.2, impressions: 340 },
      { title: "What Is Network Monitoring and Do You Need It?", keyword: "network monitoring service", position: 14.1, impressions: 210 },
    ],
    faqs_live: [
      { page: "/services/cloud-migration", question_count: 5 },
      { page: "/services/it-support", question_count: 4 },
      { page: "/", question_count: 3 },
    ],
    content_in_queue: [
      { title: "The Real Cost of IT Downtime for Small Businesses", keyword: "IT downtime cost", status: "titled" },
      { title: "HIPAA Compliance IT Checklist for Healthcare Practices", keyword: "HIPAA IT compliance", status: "titled" },
    ],

    ai_mentions: [
      { platform: "Perplexity", context: "Cited in answer to 'best managed IT services Chicago' — linked to /services/it-support" },
      { platform: "ChatGPT", context: "Brand mentioned in response about cybersecurity for small businesses (no direct link)" },
    ],
    entity_coverage_score: 72,
    entity_coverage_prior: 61,
    faq_schema_coverage_pct: 68,

    narrative: "April was our strongest month yet — clicks grew 13% and impressions crossed 42K, with average position improving from 9.1 to 8.2. The metadata rewrites on 7 position 6–14 pages are already showing movement, with 'IT support Chicago' jumping from #9 to #4. AI referral traffic hit 47 sessions, up 52% month-over-month, with ChatGPT and Perplexity both sending traffic for the first time. Two articles from prior months are now ranking and pulling impressions, validating the content strategy. Two pages need attention — data migration and the Windows 11 article both lost traffic and should be refreshed in May.",

    next_month_priorities: [
      "1. Refresh /services/data-migration — rewrite meta + add FAQ targeting 'enterprise data migration cost' (currently sliding from #12 to #17)",
      "2. Publish 2 new articles targeting the 3 new top-20 keywords identified this month (managed security, remote IT support, server maintenance)",
      "3. Expand /blog/cybersecurity-checklist — it ranked #18 within 30 days of publishing; a longer version targeting 'cybersecurity for small business' directly should capture the head term",
    ].join("\n"),
  };
}

async function main() {
  console.log("\n── Supabase Reports Table Setup ────────────────────────────────\n");
  console.log("Supabase project:", SUPABASE_URL);
  console.log();

  // ── Step 1: Check if table exists ─────────────────────────────────────────
  const { error: checkError } = await supabase.from("reports").select("id").limit(1);

  if (checkError && (checkError.code === "42P01" || checkError.code === "PGRST205")) {
    // Table doesn't exist — print SQL to run
    console.log("⚠  reports table does not exist yet.\n");
    console.log("Run this SQL in the Supabase dashboard SQL editor:");
    console.log("  https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql/new\n");
    console.log("File: Desktop/Claude/supabase-reports-migration.sql\n");
    console.log("Paste the CREATE TABLE block (everything above the INSERT) and run it.");
    console.log("Then run this script again.\n");
    process.exit(0);
  } else if (checkError) {
    console.error("Unexpected error checking table:", checkError.message);
    process.exit(1);
  }

  console.log("✓ reports table exists.\n");

  // ── Step 2: Get a real client_id ──────────────────────────────────────────
  const clientId = await getRealClientId();
  console.log();

  // ── Step 3: Insert test data ──────────────────────────────────────────────
  const row = buildTestRow(clientId);

  // Check if test data already exists for this client+month
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("client_id", clientId)
    .eq("month", 3)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`Test data already exists for client ${clientId} month 3 (id: ${existing[0].id})`);
    console.log("To re-insert, delete it first:\n");
    console.log(`  DELETE FROM reports WHERE id = '${existing[0].id}';\n`);
    process.exit(0);
  }

  const { data, error } = await supabase.from("reports").insert(row).select("id").single();

  if (error) {
    console.error("Insert failed:", error.message);
    console.error("Details:", error.details);
    process.exit(1);
  }

  console.log("✓ Test data inserted! Report ID:", data.id);
  console.log();

  // ── Find portal URL ───────────────────────────────────────────────────────
  const { data: jobs } = await supabase
    .from("jobs")
    .select("client_id, payload")
    .eq("client_id", clientId)
    .limit(1);

  console.log("────────────────────────────────────────────────────────────────");
  console.log("View the report at:\n");
  console.log("  https://seo-dashboard-teal-phi.vercel.app");
  console.log("  → find the client in /clients → open their portal → Reports tab");
  console.log("────────────────────────────────────────────────────────────────\n");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
