import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import {
  PACKAGES,
  PACKAGE_LABELS,
  getWeeklyVolumes,
  weekOfMonth,
  type PackageTier,
} from "@/lib/packages";
import { getLatestAuditRun, getLatestIssueCount } from "@/lib/audit/queries";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import {
  getGscSnapshots,
  getPageCreationSuggestionsForClient,
  getContentRefreshesForClient,
} from "@/lib/supabase";
import { GscTrendChart, type GscWeek } from "@/components/portal/ClientDashboardWidgets";
import { cn } from "@/lib/utils";

export const revalidate = 0;

function fmtMonthLabel(ym: string) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function fmtDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
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

  const now      = new Date();
  const ym       = now.toISOString().slice(0, 7);
  const [yr, mo] = ym.split("-").map(Number);
  const monthLabel = fmtMonthLabel(ym);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const currentWeekNum = weekOfMonth(now); // 1..4

  const nextMonthStart = mo === 12
    ? `${yr + 1}-01-01T00:00:00Z`
    : `${yr}-${String(mo + 1).padStart(2, "0")}-01T00:00:00Z`;
  const monthStart = `${ym}-01T00:00:00Z`;

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

  // ── Review queue ──────────────────────────────────────────────────────
  const pendingTitleCount        = contentJobs.filter((j) => j.fields.title_status === "titled").length;
  const contentReviewCount       = contentResults.filter((r) => !r.fields.portal_approval).length;
  const contentOptimizationCount = refreshes.filter((r) => r.status === "completed" && !r.portal_approval).length;
  const pageCreationPendingCount = suggestions.filter(
    (s) => (s.status === "suggested" || s.status === "content_ready") && s.portal_approval !== "skipped"
  ).length;
  const onPagePendingCount  = pending.length;
  const totalReviewCount    =
    pendingTitleCount + contentReviewCount + contentOptimizationCount +
    pageCreationPendingCount + onPagePendingCount;

  type QueueItem = {
    label: string; description: string; count: number; href: string;
    color: "amber" | "indigo" | "violet" | "emerald" | "blue";
  };
  const queueItems: QueueItem[] = ([
    { label: "SEO recommendations to approve", description: "Review and approve on-page changes before we apply them.", count: onPagePendingCount, href: `/portal/${token}/approvals`, color: "amber" },
    { label: "Article titles to sign off on",  description: "Approve titles before we write the full content.", count: pendingTitleCount, href: `/portal/${token}/content/titles`, color: "indigo" },
    { label: "Content drafts ready to review", description: "Full article drafts waiting for your read-through.", count: contentReviewCount, href: `/portal/${token}/content`, color: "violet" },
    { label: "Page rewrites ready to publish", description: "Refreshed pages awaiting your go-ahead.", count: contentOptimizationCount, href: `/portal/${token}/content-optimization`, color: "blue" },
    { label: "New page ideas to review",        description: "Tell us which new pages to build next.", count: pageCreationPendingCount, href: `/portal/${token}/page-creation`, color: "emerald" },
  ] as QueueItem[]).filter((i) => i.count > 0);

  // ── KPIs ─────────────────────────────────────────────────────────────
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
  const implementedTotal = allChanges.filter(
    (c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at
  ).length;

  // ── GSC ───────────────────────────────────────────────────────────────
  const gscWeeks: GscWeek[] = [...gscSnapshots]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((s) => ({ week_start: s.week_start, clicks: s.clicks, impressions: s.impressions, avg_position: s.avg_position }));
  const latestGsc = gscWeeks[gscWeeks.length - 1];
  const prevGsc   = gscWeeks[gscWeeks.length - 2];
  const clicksDelta = latestGsc && prevGsc ? latestGsc.clicks - prevGsc.clicks : null;

  // ── Monthly delivery schedule data ────────────────────────────────────
  const weeklyVols = getWeeklyVolumes(pkg);
  const targets    = PACKAGES[pkg];

  // 4 week date ranges (day 1-7, 8-14, 15-21, 22-end)
  const weekRanges = [
    { start: 1,  end: 7             },
    { start: 8,  end: 14            },
    { start: 15, end: 21            },
    { start: 22, end: daysInMonth   },
  ] as const;

  // Deliverable rows: label + per-week counts
  type DelivRow = { label: string; icon: string; perWeek: number[] };
  const delivRows: DelivRow[] = [
    {
      label: "Articles",
      icon: "✦",
      perWeek: weeklyVols.articles_standard.map((a, i) => a + weeklyVols.articles_longform[i]),
    },
    {
      label: "Content refreshes",
      icon: "♺",
      perWeek: weeklyVols.content_refreshes,
    },
    ...(targets.page_creation_suggestions > 0 ? [{
      label: "New pages",
      icon: "⊕",
      perWeek: weeklyVols.page_creation_suggestions,
    }] : []),
    {
      label: "Internal links",
      icon: "⌗",
      perWeek: weeklyVols.internal_links,
    },
    ...(targets.reddit_comments > 0 ? [{
      label: "Reddit threads",
      icon: "▲",
      perWeek: weeklyVols.reddit_comments,
    }] : []),
  ].filter((r) => r.perWeek.some((v) => v > 0)) as DelivRow[];

  // ─── Render ──────────────────────────────────────────────────────────
  const QUEUE_BTN: Record<string, string> = {
    amber:   "bg-amber-500 hover:bg-amber-600",
    indigo:  "bg-indigo-500 hover:bg-indigo-600",
    violet:  "bg-violet-500 hover:bg-violet-600",
    emerald: "bg-emerald-500 hover:bg-emerald-600",
    blue:    "bg-blue-500 hover:bg-blue-600",
  };
  const QUEUE_BG: Record<string, string> = {
    amber:   "bg-amber-50 border-amber-200 text-amber-900",
    indigo:  "bg-indigo-50 border-indigo-200 text-indigo-900",
    violet:  "bg-violet-50 border-violet-200 text-violet-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    blue:    "bg-blue-50 border-blue-200 text-blue-900",
  };

  return (
    <div className="space-y-7 pb-12">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome back, {contactName.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Month {monthNum} · {PACKAGE_LABELS[pkg]} plan
          </p>
        </div>
        {totalReviewCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs font-semibold text-amber-800">
              {totalReviewCount} item{totalReviewCount !== 1 ? "s" : ""} need your attention
            </span>
          </div>
        )}
      </div>

      {/* ══ Monthly Delivery Schedule ══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{monthLabel} Delivery Schedule</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              What we&rsquo;re delivering each week — {PACKAGE_LABELS[pkg]} plan
            </p>
          </div>
          <Link
            href={`/portal/${token}/deliverables`}
            className="text-xs text-indigo-600 font-semibold hover:underline"
          >
            What&rsquo;s included →
          </Link>
        </div>

        {/* 4-column week grid */}
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          {weekRanges.map((range, wIdx) => {
            const weekNum = (wIdx + 1) as 1 | 2 | 3 | 4;
            const isCurrent = weekNum === currentWeekNum;
            const isPast    = weekNum < currentWeekNum;

            const dateRange = `${fmtDay(yr, mo, range.start)}–${fmtDay(yr, mo, range.end)}`;

            // Total deliverables for this week
            const weekTotal = delivRows.reduce((s, r) => s + (r.perWeek[wIdx] ?? 0), 0);

            return (
              <div
                key={wIdx}
                className={cn(
                  "p-5",
                  isCurrent && "bg-indigo-50/60",
                  isPast    && "bg-slate-50/40"
                )}
              >
                {/* Week label */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isCurrent ? "text-indigo-600" : "text-slate-400"
                  )}>
                    Week {weekNum}
                    {isCurrent && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-bold uppercase tracking-wider normal-case">
                        Now
                      </span>
                    )}
                  </span>
                  {isPast && (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>

                {/* Date range */}
                <p className={cn(
                  "text-[11px] mb-4",
                  isCurrent ? "text-indigo-500 font-medium" : "text-slate-400"
                )}>
                  {dateRange}
                </p>

                {/* Deliverables */}
                {weekTotal === 0 ? (
                  <p className="text-xs text-slate-300 italic">No deliverables</p>
                ) : (
                  <div className="space-y-2.5">
                    {delivRows.map((row) => {
                      const count = row.perWeek[wIdx] ?? 0;
                      if (count === 0) return null;
                      return (
                        <div key={row.label} className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold shrink-0",
                            isCurrent
                              ? "bg-indigo-100 text-indigo-700"
                              : isPast
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          )}>
                            {count}
                          </span>
                          <span className={cn(
                            "text-xs leading-tight",
                            isCurrent ? "text-slate-700 font-medium" : isPast ? "text-slate-500" : "text-slate-400"
                          )}>
                            {row.label}
                          </span>
                          {isPast && (
                            <svg className="w-3 h-3 text-emerald-500 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Current week CTA */}
                {isCurrent && weekTotal > 0 && (
                  <div className="mt-4 pt-4 border-t border-indigo-100">
                    <p className="text-[11px] text-indigo-500 font-medium">In progress this week</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ Review Queue ══════════════════════════════════════════════════ */}
      {queueItems.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-sm font-bold shrink-0">
              {totalReviewCount}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {totalReviewCount === 1 ? "1 item needs" : `${totalReviewCount} items need`} your attention
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve to keep things moving.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {queueItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-5 px-6 py-4 border-l-4 hover:brightness-95 transition-all group",
                  QUEUE_BG[item.color]
                )}
              >
                <span className={cn("inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold text-white shrink-0", QUEUE_BTN[item.color])}>
                  {item.count}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{item.description}</p>
                </div>
                <span className={cn("shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors", QUEUE_BTN[item.color])}>
                  Review
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 px-6 py-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">You&rsquo;re all caught up</p>
            <p className="text-xs text-emerald-700 mt-0.5">Nothing needs your review right now.</p>
          </div>
        </div>
      )}

      {/* ══ 3 KPI tiles ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4">

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Published This Month</p>
          <p className="text-4xl font-bold text-slate-900 tabular-nums mt-2 leading-none">{totalPublishedThisMonth}</p>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            {articlesThisMonth  > 0 && <p>{articlesThisMonth} article{articlesThisMonth !== 1 ? "s" : ""}</p>}
            {refreshesThisMonth > 0 && <p>{refreshesThisMonth} page refresh{refreshesThisMonth !== 1 ? "es" : ""}</p>}
            {newPagesThisMonth  > 0 && <p>{newPagesThisMonth} new page{newPagesThisMonth !== 1 ? "s" : ""}</p>}
            {totalPublishedThisMonth === 0 && <p className="text-slate-400">Content in progress for {monthLabel}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Changes on Site</p>
          <p className="text-4xl font-bold text-slate-900 tabular-nums mt-2 leading-none">{implementedTotal}</p>
          <p className="text-xs text-slate-500 mt-3">SEO improvements applied to your site since we started.</p>
        </div>

        <div className={cn("rounded-2xl border shadow-sm p-5",
          !auditRun?.status    ? "bg-white border-slate-200"
          : auditIssueCount === 0 ? "bg-emerald-50 border-emerald-200"
          : auditIssueCount <= 5  ? "bg-amber-50 border-amber-200"
          : "bg-rose-50 border-rose-200"
        )}>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Site Audit</p>
          <p className={cn("text-4xl font-bold tabular-nums mt-2 leading-none",
            !auditRun?.status    ? "text-slate-900"
            : auditIssueCount === 0 ? "text-emerald-700"
            : auditIssueCount <= 5  ? "text-amber-700"
            : "text-rose-700"
          )}>
            {auditRun?.status ? auditIssueCount : "—"}
          </p>
          <p className={cn("text-xs mt-3",
            !auditRun?.status    ? "text-slate-400"
            : auditIssueCount === 0 ? "text-emerald-700"
            : "text-slate-600"
          )}>
            {!auditRun?.status
              ? "No audit run yet"
              : auditIssueCount === 0
              ? "No issues — your site looks great"
              : `issue${auditIssueCount !== 1 ? "s" : ""} identified — we're on it`}
          </p>
          {auditRun?.status === "complete" && auditIssueCount > 0 && (
            <Link href={`/portal/${token}/audit`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800">
              View details →
            </Link>
          )}
        </div>
      </div>

      {/* ══ GSC Traffic Chart ════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Organic Traffic</h2>
            <p className="text-xs text-slate-400 mt-0.5">Clicks from Google search — last 12 weeks</p>
          </div>
          <div className="flex items-center gap-6 text-right">
            {latestGsc && (
              <>
                <div>
                  <p className="text-xs text-slate-400">This week</p>
                  <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">{latestGsc.clicks.toLocaleString()}</p>
                  {clicksDelta !== null && (
                    <p className={cn("text-[11px] font-semibold", clicksDelta >= 0 ? "text-emerald-600" : "text-rose-500")}>
                      {clicksDelta >= 0 ? "+" : ""}{clicksDelta.toLocaleString()} vs last week
                    </p>
                  )}
                </div>
                {latestGsc.avg_position != null && (
                  <div>
                    <p className="text-xs text-slate-400">Avg. position</p>
                    <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">{latestGsc.avg_position.toFixed(1)}</p>
                    <p className="text-[11px] text-slate-400">in Google</p>
                  </div>
                )}
              </>
            )}
            {gscWeeks.length > 0 && (
              <Link href={`/portal/${token}/reports`} className="text-xs text-indigo-600 font-semibold hover:underline self-start">
                Full report →
              </Link>
            )}
          </div>
        </div>
        <GscTrendChart weeks={gscWeeks} compact />
      </div>

    </div>
  );
}
