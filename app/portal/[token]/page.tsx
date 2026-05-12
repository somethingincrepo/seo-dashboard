import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { isoMondayUTC, PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import { getLatestAuditRun, getLatestIssueCount } from "@/lib/audit/queries";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import {
  getGscSnapshots,
  getPageCreationSuggestionsForClient,
  getContentRefreshesForClient,
} from "@/lib/supabase";
import { WeeklyTargetsCard } from "@/components/portal/WeeklyTargetsCard";
import { GscTrendChart, type GscWeek } from "@/components/portal/ClientDashboardWidgets";

export const revalidate = 0;

function formatMonthLabel(ym: string) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PortalDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId    = client.fields.client_id || client.id;
  const recordId    = client.id;
  const company     = client.fields.company_name || "";
  const pkg         = (client.fields.package as PackageTier | undefined) ?? "growth";
  const monthNum    = client.fields.month_number ?? 1;
  const contactName = client.fields.contact_name || company || "there";

  const ym          = new Date().toISOString().slice(0, 7);
  const monthStart  = `${ym}-01T00:00:00Z`;
  const weekStart   = isoMondayUTC();
  const monthLabel  = formatMonthLabel(ym);

  // ── Data ────────────────────────────────────────────────────────────────
  const [
    pending,
    allChanges,
    auditRun,
    auditIssueCount,
    contentJobs,
    contentResults,
    gscSnapshots,
    suggestions,
    refreshes,
  ] = await Promise.all([
    getPendingApprovals(clientId, recordId),
    getClientChanges(clientId, recordId),
    getLatestAuditRun(recordId).catch(() => null),
    getLatestIssueCount(recordId).catch(() => 0),
    getContentJobsForClient(company).catch(() => []),
    getContentResultsForClient(company).catch(() => []),
    getGscSnapshots(clientId, 12).catch(() => []),
    getPageCreationSuggestionsForClient(recordId).catch(() => []),
    getContentRefreshesForClient(recordId).catch(() => []),
  ]);

  // ── Review queue counts ──────────────────────────────────────────────────
  const pendingTitleCount       = contentJobs.filter((j) => j.fields.title_status === "titled").length;
  const contentReviewCount      = contentResults.filter((r) => !r.fields.portal_approval).length;
  const contentOptimizationCount = refreshes.filter((r) => r.status === "completed" && !r.portal_approval).length;
  const pageCreationPendingCount = suggestions.filter(
    (s) => (s.status === "suggested" || s.status === "content_ready") && s.portal_approval !== "skipped"
  ).length;
  const onPagePendingCount = pending.length;
  const totalReviewCount =
    pendingTitleCount + contentReviewCount + contentOptimizationCount +
    pageCreationPendingCount + onPagePendingCount;

  // ── Queue items (only the ones with count > 0) ───────────────────────────
  type QueueItem = {
    label: string;
    description: string;
    count: number;
    href: string;
    color: "amber" | "indigo" | "violet" | "emerald" | "blue";
  };

  const queueItems: QueueItem[] = [
    {
      label: "SEO recommendations to approve",
      description: "Review and approve on-page changes before we apply them to your site.",
      count: onPagePendingCount,
      href: `/portal/${token}/approvals`,
      color: "amber",
    },
    {
      label: "Article titles to sign off on",
      description: "We've drafted article titles for you. Approve or swap them before we write the content.",
      count: pendingTitleCount,
      href: `/portal/${token}/content/titles`,
      color: "indigo",
    },
    {
      label: "Content drafts ready to review",
      description: "Full article drafts are written and waiting for your read-through.",
      count: contentReviewCount,
      href: `/portal/${token}/content`,
      color: "violet",
    },
    {
      label: "Page rewrites ready to publish",
      description: "We've refreshed existing pages. Approve to make them live.",
      count: contentOptimizationCount,
      href: `/portal/${token}/content-optimization`,
      color: "blue",
    },
    {
      label: "New page ideas to review",
      description: "We've identified gaps in your site. Tell us which new pages to build.",
      count: pageCreationPendingCount,
      href: `/portal/${token}/page-creation`,
      color: "emerald",
    },
  ].filter((i) => i.count > 0) as QueueItem[];

  // ── KPI stats ────────────────────────────────────────────────────────────

  // Content published this month
  const nextMonthStart = (() => {
    const [y, m] = ym.split("-").map(Number);
    return m === 12 ? `${y + 1}-01-01T00:00:00Z` : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00Z`;
  })();

  const articlesThisMonth = contentJobs.filter((j) => {
    const pa = j.fields.proposed_at as string | undefined;
    return j.fields.Status === "Completed" && pa && pa >= monthStart.slice(0, 10);
  }).length;
  const newPagesThisMonth = suggestions.filter(
    (s) => s.published_at && s.published_at >= monthStart && s.published_at < nextMonthStart
  ).length;
  const refreshesThisMonth = refreshes.filter(
    (r) => r.published_at && r.published_at >= monthStart && r.published_at < nextMonthStart
  ).length;
  const totalPublishedThisMonth = articlesThisMonth + newPagesThisMonth + refreshesThisMonth;

  // All-time implemented changes
  const implementedTotal = allChanges.filter(
    (c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at
  ).length;

  // This-week internal links for WeeklyTargetsCard
  const internalLinksThisWeek = allChanges.filter(
    (c) =>
      (c.fields.type ?? "").toLowerCase().includes("internal link") &&
      (c.fields.execution_status === "complete" || !!c.fields.implemented_at) &&
      !!(c.fields.implemented_at as string | undefined) &&
      (c.fields.implemented_at as string) >= weekStart
  ).length;

  // GSC
  const gscWeeks: GscWeek[] = [...gscSnapshots]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((s) => ({
      week_start: s.week_start,
      clicks: s.clicks,
      impressions: s.impressions,
      avg_position: s.avg_position,
    }));

  const latestGsc = gscWeeks[gscWeeks.length - 1];
  const prevGsc   = gscWeeks[gscWeeks.length - 2];
  const clicksDelta = latestGsc && prevGsc
    ? latestGsc.clicks - prevGsc.clicks
    : null;

  // ── Color maps ───────────────────────────────────────────────────────────
  const QUEUE_COLORS = {
    amber:   { bg: "bg-amber-50",   border: "border-amber-200",   badge: "bg-amber-500",   text: "text-amber-900",  sub: "text-amber-700",  btn: "bg-amber-500 hover:bg-amber-600" },
    indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  badge: "bg-indigo-500",  text: "text-indigo-900", sub: "text-indigo-700", btn: "bg-indigo-500 hover:bg-indigo-600" },
    violet:  { bg: "bg-violet-50",  border: "border-violet-200",  badge: "bg-violet-500",  text: "text-violet-900", sub: "text-violet-700", btn: "bg-violet-500 hover:bg-violet-600" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-500", text: "text-emerald-900",sub: "text-emerald-700",btn: "bg-emerald-500 hover:bg-emerald-600" },
    blue:    { bg: "bg-blue-50",    border: "border-blue-200",    badge: "bg-blue-500",    text: "text-blue-900",   sub: "text-blue-700",   btn: "bg-blue-500 hover:bg-blue-600" },
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-7 pb-12">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Welcome back, {contactName.split(" ")[0]}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Month {monthNum} · {PACKAGE_LABELS[pkg]} plan · {monthLabel}
        </p>
      </div>

      {/* ── Review queue ── */}
      {queueItems.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-sm font-bold shrink-0">
                {totalReviewCount}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {totalReviewCount === 1 ? "1 item needs" : `${totalReviewCount} items need`} your attention
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and approve so we can keep your SEO moving forward.
                </p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-slate-100">
            {queueItems.map((item) => {
              const c = QUEUE_COLORS[item.color];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-5 px-6 py-4 hover:bg-slate-50 transition-colors group"
                >
                  {/* Count badge */}
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold text-white shrink-0 ${c.badge}`}>
                    {item.count}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>

                  {/* CTA */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${c.btn}`}>
                      Review
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        /* All clear */
        <div className="flex items-center gap-4 px-6 py-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">You&rsquo;re all caught up</p>
            <p className="text-xs text-emerald-700 mt-0.5">Nothing needs your review right now. We&rsquo;ll notify you when something is ready.</p>
          </div>
        </div>
      )}

      {/* ── 3 KPI tiles ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Content published */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Published This Month</p>
          <p className="text-4xl font-bold text-slate-900 tabular-nums mt-2 leading-none">{totalPublishedThisMonth}</p>
          <div className="mt-3 space-y-1">
            {articlesThisMonth > 0 && (
              <p className="text-xs text-slate-500">{articlesThisMonth} article{articlesThisMonth !== 1 ? "s" : ""}</p>
            )}
            {refreshesThisMonth > 0 && (
              <p className="text-xs text-slate-500">{refreshesThisMonth} page refresh{refreshesThisMonth !== 1 ? "es" : ""}</p>
            )}
            {newPagesThisMonth > 0 && (
              <p className="text-xs text-slate-500">{newPagesThisMonth} new page{newPagesThisMonth !== 1 ? "s" : ""}</p>
            )}
            {totalPublishedThisMonth === 0 && (
              <p className="text-xs text-slate-400">Content in progress for {monthLabel}</p>
            )}
          </div>
        </div>

        {/* All-time changes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Changes on Your Site</p>
          <p className="text-4xl font-bold text-slate-900 tabular-nums mt-2 leading-none">{implementedTotal}</p>
          <p className="text-xs text-slate-500 mt-3">SEO improvements applied to your site since we started working together.</p>
        </div>

        {/* Audit */}
        <div className={`rounded-2xl border shadow-sm p-5 ${
          !auditRun?.status ? "bg-white border-slate-200"
          : auditIssueCount === 0 ? "bg-emerald-50 border-emerald-200"
          : auditIssueCount <= 5 ? "bg-amber-50 border-amber-200"
          : "bg-rose-50 border-rose-200"
        }`}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Site Audit</p>
          <p className={`text-4xl font-bold tabular-nums mt-2 leading-none ${
            !auditRun?.status ? "text-slate-900"
            : auditIssueCount === 0 ? "text-emerald-700"
            : auditIssueCount <= 5 ? "text-amber-700"
            : "text-rose-700"
          }`}>
            {auditRun?.status ? auditIssueCount : "—"}
          </p>
          <p className={`text-xs mt-3 ${
            !auditRun?.status ? "text-slate-400"
            : auditIssueCount === 0 ? "text-emerald-700"
            : "text-slate-600"
          }`}>
            {!auditRun?.status
              ? "No audit run yet"
              : auditIssueCount === 0
              ? "No issues — your site looks great"
              : `issue${auditIssueCount !== 1 ? "s" : ""} identified — we're working on them`}
          </p>
          {auditRun?.status === "complete" && auditIssueCount > 0 && (
            <Link
              href={`/portal/${token}/audit`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              View details →
            </Link>
          )}
        </div>
      </div>

      {/* ── GSC Traffic Chart + This Week targets ── */}
      <div className="grid grid-cols-[1fr_auto] gap-5 items-start">

        {/* GSC card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Organic Traffic</h2>
              <p className="text-xs text-slate-400 mt-0.5">Clicks from Google search — last 12 weeks</p>
            </div>
            <div className="flex items-center gap-4 text-right">
              {latestGsc && (
                <>
                  <div>
                    <p className="text-xs text-slate-400">This week</p>
                    <p className="text-lg font-bold text-slate-800 tabular-nums leading-tight">{latestGsc.clicks.toLocaleString()}</p>
                    {clicksDelta !== null && (
                      <p className={`text-[11px] font-medium ${clicksDelta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {clicksDelta >= 0 ? "+" : ""}{clicksDelta.toLocaleString()} vs last week
                      </p>
                    )}
                  </div>
                  {latestGsc.avg_position != null && (
                    <div>
                      <p className="text-xs text-slate-400">Avg. position</p>
                      <p className="text-lg font-bold text-slate-800 tabular-nums leading-tight">{latestGsc.avg_position.toFixed(1)}</p>
                      <p className="text-[11px] text-slate-400">in Google</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <GscTrendChart weeks={gscWeeks} compact />
        </div>

        {/* This week */}
        <div className="w-[380px] shrink-0">
          <WeeklyTargetsCard
            packageTier={pkg}
            delivered={{ internal_links: internalLinksThisWeek }}
          />
        </div>
      </div>

    </div>
  );
}
