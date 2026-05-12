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
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const [, m] = ym.split("-");
  return MONTHS[parseInt(m, 10) - 1];
}
function fmtShort(ym: string) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [, m] = ym.split("-");
  return MONTHS[parseInt(m, 10) - 1];
}
function fmtDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconArticle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
function IconPage({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  );
}
function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}
function IconReddit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="14" r="7"/><circle cx="4.5" cy="11" r="2"/><circle cx="19.5" cy="11" r="2"/>
      <circle cx="9.5" cy="13.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none"/>
      <path d="M9 17.5c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5"/><path d="M12 7V5"/><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.636 5.636l2.829 2.829M15.536 15.536l2.828 2.828M5.636 18.364l2.829-2.829M15.536 8.464l2.828-2.828"/>
    </svg>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PortalDashboard({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId    = client.fields.client_id || client.id;
  const recordId    = client.id;
  const company     = client.fields.company_name || "";
  const pkg         = (client.fields.package as PackageTier | undefined) ?? "growth";
  const monthNum    = client.fields.month_number ?? 1;
  const contactName = client.fields.contact_name || company || "there";
  const firstName   = contactName.split(" ")[0];

  const now      = new Date();
  const ym       = now.toISOString().slice(0, 7);
  const [yr, mo] = ym.split("-").map(Number);
  const monthFull  = fmtMonthLabel(ym);
  const monthShort = fmtShort(ym);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const currentWeekNum = weekOfMonth(now);

  const nextMonthStart = mo === 12
    ? `${yr + 1}-01-01T00:00:00Z`
    : `${yr}-${String(mo + 1).padStart(2, "0")}-01T00:00:00Z`;
  const monthStart = `${ym}-01T00:00:00Z`;

  // ── Data ─────────────────────────────────────────────────────────────
  const [pending, allChanges, auditRun, auditIssueCount, contentJobs,
         contentResults, gscSnapshots, suggestions, refreshes] = await Promise.all([
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

  // ── Review queue ─────────────────────────────────────────────────────
  const pendingTitleCount        = contentJobs.filter((j) => j.fields.title_status === "titled").length;
  const contentReviewCount       = contentResults.filter((r) => !r.fields.portal_approval).length;
  const contentOptimizationCount = refreshes.filter((r) => r.status === "completed" && !r.portal_approval).length;
  const pageCreationPendingCount = suggestions.filter(
    (s) => (s.status === "suggested" || s.status === "content_ready") && s.portal_approval !== "skipped"
  ).length;
  const onPagePendingCount = pending.length;
  const totalReviewCount   =
    pendingTitleCount + contentReviewCount + contentOptimizationCount +
    pageCreationPendingCount + onPagePendingCount;

  type QueueItem = {
    label: string; description: string; count: number; href: string;
    accent: string; iconBg: string; icon: React.ReactNode;
  };
  const queueItems: QueueItem[] = [
    { label: "SEO recommendations to approve",
      description: "On-page changes ready to apply to your site.",
      count: onPagePendingCount, href: `/portal/${token}/approvals`,
      accent: "border-l-amber-400",
      iconBg: "bg-amber-50 text-amber-600",
      icon: <IconShield className="w-4 h-4" /> },
    { label: "Article titles to sign off on",
      description: "Approve titles before we write the full articles.",
      count: pendingTitleCount, href: `/portal/${token}/content/titles`,
      accent: "border-l-indigo-400",
      iconBg: "bg-indigo-50 text-indigo-600",
      icon: <IconArticle className="w-4 h-4" /> },
    { label: "Content drafts ready to review",
      description: "Full article drafts waiting for your read-through.",
      count: contentReviewCount, href: `/portal/${token}/content`,
      accent: "border-l-violet-400",
      iconBg: "bg-violet-50 text-violet-600",
      icon: <IconSparkle className="w-4 h-4" /> },
    { label: "Page rewrites ready to publish",
      description: "Refreshed pages awaiting your go-ahead to go live.",
      count: contentOptimizationCount, href: `/portal/${token}/content-optimization`,
      accent: "border-l-blue-400",
      iconBg: "bg-blue-50 text-blue-600",
      icon: <IconRefresh className="w-4 h-4" /> },
    { label: "New page ideas to review",
      description: "Tell us which new pages to build next.",
      count: pageCreationPendingCount, href: `/portal/${token}/page-creation`,
      accent: "border-l-emerald-400",
      iconBg: "bg-emerald-50 text-emerald-600",
      icon: <IconPage className="w-4 h-4" /> },
  ].filter((i) => i.count > 0) as QueueItem[];

  // ── KPIs ─────────────────────────────────────────────────────────────
  const articlesThisMonth = contentJobs.filter((j) => {
    const pa = j.fields.proposed_at as string | undefined;
    return j.fields.Status === "Completed" && pa && pa >= monthStart.slice(0, 10);
  }).length;
  const newPagesThisMonth  = suggestions.filter((s) => s.published_at && s.published_at >= monthStart && s.published_at < nextMonthStart).length;
  const refreshesThisMonth = refreshes.filter((r) => r.published_at && r.published_at >= monthStart && r.published_at < nextMonthStart).length;
  const totalPublished     = articlesThisMonth + newPagesThisMonth + refreshesThisMonth;
  const implementedTotal   = allChanges.filter((c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at).length;

  // ── GSC ──────────────────────────────────────────────────────────────
  const gscWeeks: GscWeek[] = [...gscSnapshots]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((s) => ({ week_start: s.week_start, clicks: s.clicks, impressions: s.impressions, avg_position: s.avg_position }));
  const latestGsc   = gscWeeks[gscWeeks.length - 1];
  const prevGsc     = gscWeeks[gscWeeks.length - 2];
  const clicksDelta = latestGsc && prevGsc ? latestGsc.clicks - prevGsc.clicks : null;

  // ── Schedule data ─────────────────────────────────────────────────────
  const weeklyVols = getWeeklyVolumes(pkg);
  const targets    = PACKAGES[pkg];
  const weekRanges = [
    { start: 1, end: 7 }, { start: 8, end: 14 },
    { start: 15, end: 21 }, { start: 22, end: daysInMonth },
  ] as const;

  type DelivRow = { label: string; icon: React.ReactNode; perWeek: number[] };
  const delivRows: DelivRow[] = [
    { label: "Articles",          icon: <IconArticle className="w-3.5 h-3.5" />,
      perWeek: weeklyVols.articles_standard.map((a, i) => a + weeklyVols.articles_longform[i]) },
    { label: "Content refreshes", icon: <IconRefresh className="w-3.5 h-3.5" />,
      perWeek: weeklyVols.content_refreshes },
    ...(targets.page_creation_suggestions > 0 ? [
      { label: "New pages", icon: <IconPage className="w-3.5 h-3.5" />, perWeek: weeklyVols.page_creation_suggestions }
    ] : []),
    { label: "Internal links",    icon: <IconLink className="w-3.5 h-3.5" />,   perWeek: weeklyVols.internal_links },
    ...(targets.reddit_comments > 0 ? [
      { label: "Reddit threads",  icon: <IconReddit className="w-3.5 h-3.5" />, perWeek: weeklyVols.reddit_comments }
    ] : []),
  ].filter((r) => r.perWeek.some((v) => v > 0)) as DelivRow[];

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-16">

      {/* ══ Header ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {monthFull} · Month {monthNum} · {PACKAGE_LABELS[pkg]} plan
          </p>
        </div>
        {totalReviewCount > 0 && (
          <Link
            href={`/portal/${token}/approvals`}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors shadow-sm"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-white text-xs font-bold">
              {totalReviewCount}
            </span>
            <span className="text-sm font-semibold text-white">Items need your review</span>
            <IconChevron className="w-4 h-4 text-white/70" />
          </Link>
        )}
      </div>

      {/* ══ Monthly Delivery Schedule ═════════════════════════════════════ */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-[0_2px_8px_rgba(16,24,40,0.06)]">

        {/* Gradient header */}
        <div className="px-7 py-6 bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-indigo-200 text-[11px] font-semibold uppercase tracking-widest mb-1">Delivery Schedule</p>
              <h2 className="text-white text-2xl font-bold tracking-tight">{monthFull}</h2>
              <p className="text-indigo-200 text-sm mt-0.5">{PACKAGE_LABELS[pkg]} plan · Month {monthNum}</p>
            </div>

            {/* Week progress indicator */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5">
                {([1, 2, 3, 4] as const).map((w) => (
                  <div
                    key={w}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      w < currentWeekNum  ? "w-8 bg-emerald-400" :
                      w === currentWeekNum ? "w-8 bg-white" :
                                            "w-5 bg-white/25"
                    )}
                  />
                ))}
              </div>
              <p className="text-indigo-200 text-xs font-medium">
                Week {currentWeekNum} of 4
              </p>
            </div>
          </div>
        </div>

        {/* 4-column week grid */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 bg-white">
          {weekRanges.map((range, wIdx) => {
            const weekNum = wIdx + 1;
            const isCurrent = weekNum === currentWeekNum;
            const isPast    = weekNum < currentWeekNum;
            const weekTotal = delivRows.reduce((s, r) => s + (r.perWeek[wIdx] ?? 0), 0);
            const dateLabel = `${fmtDay(yr, mo, range.start)} – ${fmtDay(yr, mo, range.end)}`;

            return (
              <div
                key={wIdx}
                className={cn(
                  "relative p-5 pt-4",
                  isCurrent && "bg-indigo-50/40"
                )}
              >
                {/* Current week top accent bar */}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
                )}

                {/* Week header */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-wider",
                    isCurrent ? "text-indigo-600" : isPast ? "text-slate-400" : "text-slate-400"
                  )}>
                    Week {weekNum}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500 text-white">
                      Now
                    </span>
                  )}
                  {isPast && (
                    <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                      <IconCheck className="w-2.5 h-2.5 text-emerald-600" />
                    </div>
                  )}
                </div>

                <p className={cn("text-[11px] mb-4", isCurrent ? "text-indigo-500 font-medium" : "text-slate-400")}>
                  {dateLabel}
                </p>

                {/* Deliverables */}
                {weekTotal === 0 ? (
                  <p className="text-xs text-slate-300 italic">Rest week</p>
                ) : (
                  <div className="space-y-2">
                    {delivRows.map((row) => {
                      const count = row.perWeek[wIdx] ?? 0;
                      if (count === 0) return null;
                      return (
                        <div key={row.label} className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0",
                            isCurrent  ? "bg-indigo-100 text-indigo-700" :
                            isPast     ? "bg-emerald-100 text-emerald-600" :
                                         "bg-slate-100 text-slate-400"
                          )}>
                            {row.icon}
                          </span>
                          <span className={cn(
                            "text-xs leading-tight flex-1",
                            isCurrent ? "text-slate-700 font-medium" :
                            isPast    ? "text-slate-400" :
                                        "text-slate-400"
                          )}>
                            <span className={cn(
                              "font-bold mr-1",
                              isCurrent ? "text-indigo-700" : isPast ? "text-emerald-600" : "text-slate-500"
                            )}>{count}</span>
                            {row.label}
                          </span>
                          {isPast && <IconCheck className="w-3 h-3 text-emerald-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isCurrent && weekTotal > 0 && (
                  <p className="mt-4 text-[10px] text-indigo-400 font-medium uppercase tracking-wider">In progress</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ Review Queue ══════════════════════════════════════════════════ */}
      {queueItems.length > 0 ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-semibold text-slate-900">Needs your attention</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {totalReviewCount} item{totalReviewCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {queueItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 bg-white rounded-xl",
                  "border border-slate-200 border-l-4",
                  item.accent,
                  "hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)] hover:border-slate-300 transition-all group"
                )}
              >
                {/* Icon */}
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.iconBg)}>
                  {item.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 leading-tight">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                </div>

                {/* Count + arrow */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-lg font-bold text-slate-800 tabular-nums w-8 text-center">{item.count}</span>
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">Review</span>
                  <IconChevron className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl border border-emerald-200 bg-emerald-50">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
            <IconCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">You&rsquo;re all caught up</p>
            <p className="text-xs text-emerald-700 mt-0.5">Nothing needs your review right now. We&rsquo;ll notify you when something is ready.</p>
          </div>
        </div>
      )}

      {/* ══ KPI Tiles ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4">

        {/* Published */}
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
          <div className="absolute right-4 top-4 opacity-[0.06]">
            <IconArticle className="w-16 h-16 text-slate-900" />
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Published This Month</p>
          <p className="text-5xl font-bold text-slate-900 tabular-nums mt-3 leading-none">{totalPublished}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {articlesThisMonth  > 0 && <p className="text-xs text-slate-500">{articlesThisMonth} article{articlesThisMonth !== 1 ? "s" : ""}</p>}
            {refreshesThisMonth > 0 && <p className="text-xs text-slate-500">{refreshesThisMonth} refresh{refreshesThisMonth !== 1 ? "es" : ""}</p>}
            {newPagesThisMonth  > 0 && <p className="text-xs text-slate-500">{newPagesThisMonth} new page{newPagesThisMonth !== 1 ? "s" : ""}</p>}
            {totalPublished === 0 && <p className="text-xs text-slate-400">Content in progress for {monthShort}</p>}
          </div>
        </div>

        {/* Changes */}
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
          <div className="absolute right-4 top-4 opacity-[0.06]">
            <IconShield className="w-16 h-16 text-slate-900" />
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Changes on Your Site</p>
          <p className="text-5xl font-bold text-slate-900 tabular-nums mt-3 leading-none">{implementedTotal}</p>
          <p className="text-xs text-slate-500 mt-4">
            SEO improvements applied since we started.
          </p>
        </div>

        {/* Audit */}
        <div className={cn(
          "relative rounded-2xl border shadow-sm p-6 overflow-hidden",
          !auditRun?.status        ? "bg-white border-slate-200" :
          auditIssueCount === 0    ? "bg-emerald-50 border-emerald-200" :
          auditIssueCount <= 5     ? "bg-amber-50 border-amber-200" :
                                     "bg-rose-50 border-rose-200"
        )}>
          <div className="absolute right-4 top-4 opacity-[0.08]">
            <IconSparkle className="w-16 h-16 text-slate-900" />
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Site Health</p>
          <p className={cn(
            "text-5xl font-bold tabular-nums mt-3 leading-none",
            !auditRun?.status     ? "text-slate-900" :
            auditIssueCount === 0 ? "text-emerald-700" :
            auditIssueCount <= 5  ? "text-amber-700" :
                                    "text-rose-700"
          )}>
            {auditRun?.status ? auditIssueCount : "—"}
          </p>
          <p className={cn("text-xs mt-4",
            !auditRun?.status     ? "text-slate-400" :
            auditIssueCount === 0 ? "text-emerald-700" :
                                    "text-slate-600"
          )}>
            {!auditRun?.status ? "No audit run yet" :
             auditIssueCount === 0 ? "No issues detected" :
             `issue${auditIssueCount !== 1 ? "s" : ""} identified — we're working on them`}
          </p>
          {auditRun?.status === "complete" && auditIssueCount > 0 && (
            <Link href={`/portal/${token}/audit`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900">
              View details <IconChevron className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* ══ Organic Traffic ══════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Organic Traffic</h2>
            <p className="text-xs text-slate-500 mt-0.5">Clicks from Google — last 12 weeks</p>
          </div>
          <div className="flex items-start gap-6">
            {latestGsc && (
              <>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5">This week</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{latestGsc.clicks.toLocaleString()}</p>
                  {clicksDelta !== null && (
                    <p className={cn("text-xs font-semibold mt-0.5", clicksDelta >= 0 ? "text-emerald-600" : "text-rose-500")}>
                      {clicksDelta >= 0 ? "+" : ""}{clicksDelta.toLocaleString()} vs last week
                    </p>
                  )}
                </div>
                {latestGsc.avg_position != null && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-0.5">Avg. position</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{latestGsc.avg_position.toFixed(1)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">in Google</p>
                  </div>
                )}
              </>
            )}
            {gscWeeks.length > 0 && (
              <Link href={`/portal/${token}/reports`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 self-start mt-0.5">
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
