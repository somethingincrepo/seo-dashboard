import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { isoMondayUTC, PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import { getLatestAuditRun, getLatestIssueCount } from "@/lib/audit/queries";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import {
  getSupabase,
  getGscSnapshots,
  getPageCreationSuggestionsForClient,
  getContentRefreshesForClient,
} from "@/lib/supabase";
import { WeeklyTargetsCard } from "@/components/portal/WeeklyTargetsCard";
import {
  PortalKpiTile,
  ActionItemsCard,
  GscTrendChart,
  ClientPipelineFunnel,
  DeliverableProgress,
  RecentChangesTimeline,
  type ActionItem,
  type DeliverableRow,
  type RecentChange,
  type GscWeek,
} from "@/components/portal/ClientDashboardWidgets";

export const revalidate = 0;

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}
function nextMonthStart(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01T00:00:00Z` : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00Z`;
}
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

  const clientId   = client.fields.client_id || client.id;
  const recordId   = client.id;
  const company    = client.fields.company_name || "";
  const pkg        = (client.fields.package as PackageTier | undefined) ?? "growth";
  const monthNum   = client.fields.month_number ?? 1;
  const contactName = client.fields.contact_name || company || "there";

  const ym         = currentYearMonth();
  const monthStart = `${ym}-01T00:00:00Z`;
  const monthEnd   = nextMonthStart(ym);
  const weekStart  = isoMondayUTC();
  const monthLabel = formatMonthLabel(ym);

  // ── Fetch all data in parallel ───────────────────────────────────────────
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

  // ── KPI computations ─────────────────────────────────────────────────────

  // Pending titles to review
  const pendingTitleCount = contentJobs.filter((j) => j.fields.title_status === "titled").length;

  // Content drafts needing portal review
  const contentReviewCount = contentResults.filter((r) => !r.fields.portal_approval).length;

  // Page optimizations awaiting approval
  const contentOptimizationCount = refreshes.filter(
    (r) => r.status === "completed" && !r.portal_approval
  ).length;

  // New page suggestions awaiting approval
  const pageCreationPendingCount = suggestions.filter(
    (s) => (s.status === "suggested" || s.status === "content_ready") && s.portal_approval !== "skipped"
  ).length;

  // On-page SEO changes (internal links etc.) needing review
  const onPagePendingCount = pending.length;

  // Total review queue
  const totalReviewCount =
    pendingTitleCount + contentReviewCount + contentOptimizationCount + pageCreationPendingCount + onPagePendingCount;

  // Implemented changes this month
  const implementedThisMonth = allChanges.filter(
    (c) =>
      (c.fields.execution_status === "complete" || !!c.fields.implemented_at) &&
      (c.fields.implemented_at as string | undefined) &&
      (c.fields.implemented_at as string) >= monthStart &&
      (c.fields.implemented_at as string) < monthEnd
  ).length;

  // Total ever implemented
  const implementedTotal = allChanges.filter(
    (c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at
  ).length;

  // Content published this month: new pages + refreshes
  const newPagesThisMonth = suggestions.filter(
    (s) => s.published_at && s.published_at >= monthStart && s.published_at < monthEnd
  ).length;
  const refreshesThisMonth = refreshes.filter(
    (r) => r.published_at && r.published_at >= monthStart && r.published_at < monthEnd
  ).length;
  // Articles completed this month (from content jobs)
  const articlesThisMonth = contentJobs.filter((j) => {
    const pa = j.fields.proposed_at as string | undefined;
    return j.fields.Status === "Completed" && pa && pa >= monthStart.slice(0, 10) && pa < monthEnd.slice(0, 10);
  }).length;
  const contentPublishedThisMonth = articlesThisMonth + newPagesThisMonth + refreshesThisMonth;

  // ── Action items for the review queue card ────────────────────────────────

  const actionItems: ActionItem[] = [
    {
      label: "SEO changes to review",
      count: onPagePendingCount,
      href: `/portal/${token}/approvals/on-page`,
      accent: "amber",
      description: "On-page optimizations pending your approval",
    },
    {
      label: "Article titles to approve",
      count: pendingTitleCount,
      href: `/portal/${token}/content/titles`,
      accent: "indigo",
      description: "Content titles ready for your sign-off",
    },
    {
      label: "Content drafts to review",
      count: contentReviewCount,
      href: `/portal/${token}/content`,
      accent: "violet",
      description: "Full article drafts awaiting your review",
    },
    {
      label: "Page optimizations",
      count: contentOptimizationCount,
      href: `/portal/${token}/approvals/content`,
      accent: "emerald",
      description: "Existing pages refreshed and ready to publish",
    },
    {
      label: "New page suggestions",
      count: pageCreationPendingCount,
      href: `/portal/${token}/page-creation`,
      accent: "rose",
      description: "New page opportunities for your approval",
    },
  ];

  // ── Monthly deliverable progress ──────────────────────────────────────────

  const targets = PACKAGES[pkg];
  const isThisWeek = (iso?: string) => !!iso && iso >= weekStart;

  const internalLinksThisMonth = allChanges.filter(
    (c) =>
      (c.fields.type ?? "").toLowerCase().includes("internal link") &&
      (c.fields.execution_status === "complete" || !!c.fields.implemented_at) &&
      (c.fields.implemented_at as string | undefined) &&
      (c.fields.implemented_at as string) >= monthStart
  ).length;

  // Pull content job actuals from Supabase content_refreshes + page_creation for this month
  let contentRefreshMonthCount = 0;
  let pageCreationMonthCount = 0;
  try {
    const [crData, pcData] = await Promise.all([
      getSupabase()
        .from("content_refreshes")
        .select("id", { count: "exact" })
        .eq("client_id", recordId)
        .gte("proposed_at", monthStart.slice(0, 10))
        .in("status", ["completed", "approved_for_publish", "published"]),
      getSupabase()
        .from("page_creation_suggestions")
        .select("id", { count: "exact" })
        .eq("client_id", recordId)
        .gte("proposed_at", monthStart.slice(0, 10))
        .not("status", "in", '("skipped","dismissed")'),
    ]);
    contentRefreshMonthCount = crData.count ?? 0;
    pageCreationMonthCount = pcData.count ?? 0;
  } catch {
    // non-fatal
  }

  const deliverableRows: DeliverableRow[] = [
    {
      label: "Articles published",
      actual: articlesThisMonth,
      target: targets.articles_standard + targets.articles_longform,
      color: "#6366f1",
    },
    {
      label: "Content refreshes",
      actual: contentRefreshMonthCount,
      target: targets.content_refreshes,
      color: "#3b82f6",
    },
    {
      label: "New pages",
      actual: pageCreationMonthCount,
      target: targets.page_creation_suggestions,
      color: "#8b5cf6",
    },
    {
      label: "Internal links added",
      actual: internalLinksThisMonth,
      target: targets.internal_links,
      color: "#f59e0b",
    },
  ].filter((r) => r.target > 0);

  // ── Content pipeline funnel ───────────────────────────────────────────────

  const funnelSuggestions = suggestions.length > 0 ? [
    {
      label: "Suggested",
      count: suggestions.length,
      color: "linear-gradient(90deg,#6366f1,#818cf8)",
      description: "Pages we identified as gap opportunities",
    },
    {
      label: "Approved",
      count: suggestions.filter(
        (s) =>
          s.portal_approval === "approved" ||
          ["generating","content_ready","approved_for_publish","published"].includes(s.status)
      ).length,
      color: "linear-gradient(90deg,#3b82f6,#60a5fa)",
      description: "Pages you approved for content creation",
    },
    {
      label: "Content written",
      count: suggestions.filter((s) =>
        s.generated_at !== null ||
        ["content_ready","approved_for_publish","published"].includes(s.status)
      ).length,
      color: "linear-gradient(90deg,#06b6d4,#22d3ee)",
      description: "Full page content generated by AI",
    },
    {
      label: "Published",
      count: suggestions.filter((s) => s.status === "published" || s.published_at !== null).length,
      color: "linear-gradient(90deg,#10b981,#34d399)",
      description: "Live on your site",
    },
  ] : [];

  // ── Recent changes for timeline ───────────────────────────────────────────

  const recentChanges: RecentChange[] = allChanges
    .slice(0, 8)
    .map((c) => {
      const isImpl = c.fields.execution_status === "complete" || !!c.fields.implemented_at;
      const isApproved = (c.fields.approval || c.fields.approval_status) === "approved";
      return {
        label: (c.fields.change_title || c.fields.type || "Change") as string,
        type: (c.fields.type || "SEO change") as string,
        date: (c.fields.implemented_at || null) as string | null,
        status: isImpl ? "implemented" : isApproved ? "approved" : "pending",
      } satisfies RecentChange;
    });

  // ── GSC weeks for chart ───────────────────────────────────────────────────

  const gscWeeks: GscWeek[] = gscSnapshots.map((s) => ({
    week_start: s.week_start,
    clicks: s.clicks,
    impressions: s.impressions,
    avg_position: s.avg_position,
  }));

  // ── Weekly targets (this week's actuals) ─────────────────────────────────

  const internalLinksThisWeek = allChanges.filter(
    (c) =>
      (c.fields.type ?? "").toLowerCase().includes("internal link") &&
      (c.fields.execution_status === "complete" || !!c.fields.implemented_at) &&
      isThisWeek(c.fields.implemented_at as string | undefined)
  ).length;

  // ── Audit health ─────────────────────────────────────────────────────────

  const auditStatus = auditRun?.status ?? null;
  const auditHealthPct = auditRun
    ? Math.max(0, Math.round(100 - (auditIssueCount / Math.max(auditRun.pages_crawled ?? 20, 1)) * 5))
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12 max-w-[1080px]">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Welcome back, {contactName.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Month {monthNum} · {PACKAGE_LABELS[pkg]} plan · {monthLabel}
          </p>
        </div>
        {totalReviewCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-xs font-medium text-amber-800">
              {totalReviewCount} item{totalReviewCount !== 1 ? "s" : ""} need your attention
            </span>
          </div>
        )}
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-4">
        <PortalKpiTile
          label="Awaiting Your Review"
          value={totalReviewCount}
          sub={totalReviewCount > 0 ? "Items need your approval to proceed" : "You're all caught up"}
          accent={totalReviewCount > 0 ? "amber" : "emerald"}
          href={`/portal/${token}/approvals`}
          cta={totalReviewCount > 0 ? "Review now" : undefined}
        />
        <PortalKpiTile
          label="Content Published"
          value={contentPublishedThisMonth}
          sub={`${articlesThisMonth} articles · ${refreshesThisMonth} refreshes · ${newPagesThisMonth} new pages`}
          accent="indigo"
        />
        <PortalKpiTile
          label="Changes on Your Site"
          value={implementedTotal}
          sub={`${implementedThisMonth > 0 ? `${implementedThisMonth} added this month · ` : ""}all time`}
          accent="violet"
        />
        <PortalKpiTile
          label="Audit Issues Found"
          value={auditStatus ? auditIssueCount : "—"}
          sub={
            auditStatus === "complete"
              ? auditIssueCount === 0
                ? "No issues detected"
                : `${auditIssueCount} issue${auditIssueCount !== 1 ? "s" : ""} identified`
              : auditStatus
              ? "Audit in progress"
              : "No audit run yet"
          }
          accent={
            !auditStatus ? "slate"
            : auditIssueCount === 0 ? "emerald"
            : auditIssueCount > 10 ? "rose"
            : "amber"
          }
          href={auditStatus === "complete" ? `/portal/${token}/audit` : undefined}
          cta={auditStatus === "complete" && auditIssueCount > 0 ? "View issues" : undefined}
        />
      </div>

      {/* ── Action Items + GSC Chart ── */}
      <div className="grid grid-cols-[340px_1fr] gap-5">

        <ActionItemsCard items={actionItems} token={token} />

        {/* GSC trend */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Organic Traffic</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 12 weeks · Google Search Console</p>
            </div>
            {gscWeeks.length > 0 && (
              <a
                href={`/portal/${token}/reports`}
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                Full report →
              </a>
            )}
          </div>
          <GscTrendChart weeks={gscWeeks} />
        </div>
      </div>

      {/* ── Monthly Progress + Recent Changes ── */}
      <div className="grid grid-cols-[1fr_280px] gap-5">

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] p-5">
          <DeliverableProgress rows={deliverableRows} monthLabel={monthLabel} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Recent Changes</h3>
            <a href={`/portal/${token}/activity`} className="text-xs text-indigo-600 hover:underline font-medium">All →</a>
          </div>
          <RecentChangesTimeline changes={recentChanges} />
        </div>
      </div>

      {/* ── Content Pipeline Funnel ── */}
      {funnelSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] p-5">
          <ClientPipelineFunnel
            stages={funnelSuggestions}
            title="New Page Pipeline"
            total={suggestions.length}
          />
        </div>
      )}

      {/* ── This Week Targets ── */}
      <WeeklyTargetsCard
        packageTier={pkg}
        delivered={{ internal_links: internalLinksThisWeek }}
      />
    </div>
  );
}
