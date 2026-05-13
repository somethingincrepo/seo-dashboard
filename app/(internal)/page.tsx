import Link from "next/link";
import { getClients } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { getSupabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  KpiTile,
  FunnelChart,
  CostTrendChart,
  SopFreqChart,
  StatusDonut,
  HealthBadge,
  HealthDistribution,
} from "./_components/DashboardCharts";

export const dynamic = "force-dynamic";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

function nextMonthStart(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01-01T00:00:00Z`
    : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00Z`;
}

function nDaysAgoIso(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function daysBetween(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function daysAgoLabel(iso: string | null) {
  if (!iso) return "Never";
  const d = daysBetween(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function formatMonthLabel(ym: string) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SlimJob = {
  client_id: string | null;
  status: string;
  cost_usd: number;
  sop_name: string;
  created_at: string;
};

type SlimSuggestion = {
  client_id: string;
  status: string;
  proposed_at: string;
  portal_approval: string | null;
  portal_approved_at: string | null;
  generated_at: string | null;
  content_portal_approval: string | null;
  content_portal_approved_at: string | null;
  published_at: string | null;
};

type SlimRefresh = {
  client_id: string;
  status: string;
  proposed_at: string;
  portal_approval: string | null;
  portal_approved_at: string | null;
  published_at: string | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const ym         = currentYearMonth();
  const monthStart = `${ym}-01T00:00:00Z`;
  const monthEnd   = nextMonthStart(ym);
  const ago30      = nDaysAgoIso(30);

  let sb;
  try { sb = getSupabase(); } catch { sb = null; }

  const empty = <T,>(): Promise<T[]> => Promise.resolve([] as T[]);

  const [clients, pendingChanges, jobsThisMonth, jobs30d, suggestions, refreshes] =
    await Promise.all([
      getClients(),
      getPendingApprovals(),

      sb ? sb.from("jobs")
        .select("client_id,status,cost_usd,sop_name,created_at")
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd)
        .order("created_at", { ascending: false })
        .then((r) => (r.data ?? []) as SlimJob[]) : empty<SlimJob>(),

      sb ? sb.from("jobs")
        .select("client_id,status,cost_usd,sop_name,created_at")
        .gte("created_at", ago30)
        .order("created_at", { ascending: false })
        .then((r) => (r.data ?? []) as SlimJob[]) : empty<SlimJob>(),

      sb ? sb.from("page_creation_suggestions")
        .select("client_id,status,proposed_at,portal_approval,portal_approved_at,generated_at,content_portal_approval,content_portal_approved_at,published_at")
        .order("proposed_at", { ascending: false })
        .then((r) => (r.data ?? []) as SlimSuggestion[]) : empty<SlimSuggestion>(),

      sb ? sb.from("content_refreshes")
        .select("client_id,status,proposed_at,portal_approval,portal_approved_at,published_at")
        .order("proposed_at", { ascending: false })
        .then((r) => (r.data ?? []) as SlimRefresh[]) : empty<SlimRefresh>(),
    ]);

  // ── Active client list ────────────────────────────────────────────────────
  const activeClients = clients.filter(
    (c) =>
      !!c.fields.company_name &&
      !["offboarded", "paused", "churned"].includes(c.fields.status ?? "")
  );

  // ── KPI numbers ───────────────────────────────────────────────────────────
  const newPagesThisMonth = suggestions.filter(
    (s) => s.published_at && s.published_at >= monthStart && s.published_at < monthEnd
  ).length;

  const refreshesThisMonth = refreshes.filter(
    (r) => r.published_at && r.published_at >= monthStart && r.published_at < monthEnd
  ).length;

  const activeJobsNow = jobsThisMonth.filter((j) =>
    ["pending", "claimed", "running"].includes(j.status)
  ).length;

  const totalCostMonth = jobsThisMonth.reduce((s, j) => s + (j.cost_usd ?? 0), 0);

  // ── Page creation funnel ─────────────────────────────────────────────────
  const funnelStages = [
    {
      label: "Suggested",
      count: suggestions.length,
      color: "linear-gradient(90deg,#6366f1,#818cf8)",
    },
    {
      label: "Portal Approved",
      count: suggestions.filter(
        (s) =>
          s.portal_approval === "approved" ||
          ["generating", "content_ready", "approved_for_publish", "published"].includes(s.status)
      ).length,
      color: "linear-gradient(90deg,#3b82f6,#60a5fa)",
    },
    {
      label: "Content Generated",
      count: suggestions.filter(
        (s) =>
          s.generated_at !== null ||
          ["content_ready", "approved_for_publish", "published"].includes(s.status)
      ).length,
      color: "linear-gradient(90deg,#06b6d4,#22d3ee)",
    },
    {
      label: "Content Approved",
      count: suggestions.filter(
        (s) =>
          s.content_portal_approval === "approved" ||
          ["approved_for_publish", "published"].includes(s.status)
      ).length,
      color: "linear-gradient(90deg,#10b981,#34d399)",
    },
    {
      label: "Published",
      count: suggestions.filter((s) => s.status === "published" || s.published_at !== null).length,
      color: "linear-gradient(90deg,#059669,#10b981)",
    },
  ];

  // ── Content refresh funnel (separate) ────────────────────────────────────
  const refreshFunnel = [
    {
      label: "Proposed",
      count: refreshes.length,
      color: "linear-gradient(90deg,#8b5cf6,#a78bfa)",
    },
    {
      label: "Portal Approved",
      count: refreshes.filter(
        (r) =>
          r.portal_approval === "approved" ||
          ["approved_for_publish", "published"].includes(r.status)
      ).length,
      color: "linear-gradient(90deg,#7c3aed,#8b5cf6)",
    },
    {
      label: "Published",
      count: refreshes.filter((r) => r.published_at !== null || r.status === "published").length,
      color: "linear-gradient(90deg,#6d28d9,#7c3aed)",
    },
  ];

  // ── 30-day cost trend ────────────────────────────────────────────────────
  const dailyCosts: Record<string, number> = {};
  for (const j of jobs30d) {
    const day = j.created_at.slice(0, 10);
    dailyCosts[day] = (dailyCosts[day] ?? 0) + (j.cost_usd ?? 0);
  }
  const costTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86_400_000);
    const day = d.toISOString().slice(0, 10);
    return { day, cost: dailyCosts[day] ?? 0 };
  });

  // ── SOP frequency ─────────────────────────────────────────────────────────
  const sopCounts: Record<string, number> = {};
  for (const j of jobsThisMonth) {
    if (j.sop_name) sopCounts[j.sop_name] = (sopCounts[j.sop_name] ?? 0) + 1;
  }
  const topSops = Object.entries(sopCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // ── Job status breakdown ──────────────────────────────────────────────────
  const jobsDone   = jobsThisMonth.filter((j) => j.status === "done").length;
  const jobsFailed = jobsThisMonth.filter((j) => j.status === "failed").length;
  const jobsActive = jobsThisMonth.filter((j) =>
    ["pending", "claimed", "running"].includes(j.status)
  ).length;

  // ── Per-client scorecard data ─────────────────────────────────────────────
  const lastJobBySlug = new Map<string, string>();
  for (const j of jobs30d) {
    if (j.client_id && !lastJobBySlug.has(j.client_id)) {
      lastJobBySlug.set(j.client_id, j.created_at);
    }
  }

  const pendingByAirtableId = new Map<string, number>();
  for (const c of pendingChanges) {
    const rawCid = c.fields.client_id;
    const cid = (Array.isArray(rawCid) ? rawCid[0] : rawCid) ?? "__none__";
    pendingByAirtableId.set(cid, (pendingByAirtableId.get(cid) ?? 0) + 1);
  }

  const newPagesBySlug = new Map<string, number>();
  for (const s of suggestions) {
    if (s.published_at && s.published_at >= monthStart && s.published_at < monthEnd) {
      newPagesBySlug.set(s.client_id, (newPagesBySlug.get(s.client_id) ?? 0) + 1);
    }
  }

  const refreshesBySlug = new Map<string, number>();
  for (const r of refreshes) {
    if (r.published_at && r.published_at >= monthStart && r.published_at < monthEnd) {
      refreshesBySlug.set(r.client_id, (refreshesBySlug.get(r.client_id) ?? 0) + 1);
    }
  }

  function clientHealth(slug: string): "healthy" | "attention" | "at_risk" {
    const last = lastJobBySlug.get(slug);
    if (!last) return "at_risk";
    const d = daysBetween(last);
    if (d <= 7)  return "healthy";
    if (d <= 14) return "attention";
    return "at_risk";
  }

  const HEALTH_ORDER = { at_risk: 0, attention: 1, healthy: 2 };

  const scorecardClients = activeClients
    .map((c) => {
      const slug   = c.fields.client_id ?? "";
      const health = clientHealth(slug);
      return {
        id:       c.id,
        name:     c.fields.company_name ?? "",
        url:      (c.fields.site_url ?? "").replace(/^https?:\/\//, ""),
        slug,
        health,
        newPages:       newPagesBySlug.get(slug) ?? 0,
        refreshesCount: refreshesBySlug.get(slug) ?? 0,
        lastJob:  lastJobBySlug.get(slug) ?? null,
        pending:  pendingByAirtableId.get(c.id) ?? 0,
        monthNum: c.fields.month_number,
        status:   c.fields.status ?? c.fields.plan_status,
      };
    })
    .sort((a, b) => {
      if (HEALTH_ORDER[a.health] !== HEALTH_ORDER[b.health])
        return HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
      return a.name.localeCompare(b.name);
    });

  const healthCounts = { healthy: 0, attention: 0, at_risk: 0 };
  for (const c of scorecardClients) healthCounts[c.health]++;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-7 max-w-[1160px] pb-12">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">SEO delivery overview · {formatMonthLabel(ym)}</p>
        </div>
        <HealthDistribution
          healthy={healthCounts.healthy}
          attention={healthCounts.attention}
          atRisk={healthCounts.at_risk}
          total={activeClients.length}
        />
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-5 gap-4">
        <KpiTile
          label="Active Clients"
          value={activeClients.length}
          sub="Currently managed"
          accent="indigo"
          icon="◈"
          href="/clients"
        />
        <KpiTile
          label="New Pages Published"
          value={newPagesThisMonth}
          sub={`This month`}
          accent="emerald"
          icon="✦"
        />
        <KpiTile
          label="Refreshes Published"
          value={refreshesThisMonth}
          sub={`This month`}
          accent="blue"
          icon="♺"
        />
        <KpiTile
          label="Active Jobs"
          value={activeJobsNow}
          sub="Currently running"
          accent={activeJobsNow > 0 ? "amber" : "slate"}
          icon="⬡"
          href="/activity"
        />
        <KpiTile
          label="AI Cost"
          value={`$${totalCostMonth.toFixed(2)}`}
          sub={formatMonthLabel(ym)}
          accent="violet"
          icon="◎"
          href="/token-usage"
        />
      </div>

      {/* ── Funnels Row ── */}
      <div className="grid grid-cols-[1fr_320px] gap-5">

        {/* Page creation funnel */}
        <GlassCard className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">New Page Creation Funnel</h2>
              <p className="text-xs text-slate-400 mt-0.5">All-time · {suggestions.length} suggestions</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
              {funnelStages[4].count} published
            </span>
          </div>
          <FunnelChart stages={funnelStages} />

          {/* Divider: content refresh mini-funnel below */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-700">Content Refresh Funnel</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{refreshes.length} pages in pipeline</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-600 font-medium">
                {refreshFunnel[2].count} published
              </span>
            </div>
            <FunnelChart stages={refreshFunnel} />
          </div>
        </GlassCard>

        {/* Job status donut */}
        <GlassCard className="p-6 flex flex-col">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-slate-800">Job Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">This calendar month</p>
          </div>

          <StatusDonut done={jobsDone} failed={jobsFailed} active={jobsActive} />

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
            <StatBox label="Total" value={jobsThisMonth.length} />
            <StatBox
              label="Success"
              value={`${jobsThisMonth.length > 0 ? Math.round((jobsDone / jobsThisMonth.length) * 100) : 0}%`}
              highlight
            />
            <StatBox label="Failed" value={jobsFailed} warn={jobsFailed > 0} />
          </div>

          {/* Month cost recap */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Month cost</span>
              <span className="font-semibold text-violet-600">${totalCostMonth.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-slate-400">Avg cost / job</span>
              <span className="font-semibold text-slate-600">
                ${jobsThisMonth.length > 0 ? (totalCostMonth / jobsThisMonth.length).toFixed(5) : "0.00000"}
              </span>
            </div>
          </div>

          {/* Link to jobs */}
          <div className="mt-auto pt-5">
            <Link
              href="/activity"
              className="block w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-medium py-2 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              View all jobs →
            </Link>
          </div>
        </GlassCard>
      </div>

      {/* ── Cost Trend + SOP Frequency ── */}
      <div className="grid grid-cols-2 gap-5">

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">AI Cost — Last 30 Days</h2>
              <p className="text-xs text-slate-400 mt-0.5">Daily spend across all jobs</p>
            </div>
            <Link
              href="/token-usage"
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Details →
            </Link>
          </div>
          <CostTrendChart data={costTrend} />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Top SOPs This Month</h2>
              <p className="text-xs text-slate-400 mt-0.5">By run count · {jobsThisMonth.length} total runs</p>
            </div>
          </div>
          <SopFreqChart sops={topSops} />
        </GlassCard>
      </div>

      {/* ── Client Delivery Scorecard ── */}
      <GlassCard>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Client Delivery Scorecard</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Health, output, and activity per client this month
            </p>
          </div>
          <Link href="/clients" className="text-xs text-indigo-600 hover:underline font-medium">
            Manage clients →
          </Link>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_150px_80px_80px_100px_80px_56px] gap-x-4 px-6 py-2.5 bg-slate-50/70 border-b border-slate-100">
          {["Client", "Health", "New Pages", "Refreshes", "Last Job", "Pending", "Month"].map(
            (h, i) => (
              <span
                key={h}
                className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider ${
                  i === 0 ? "" : i >= 2 ? "text-center" : ""
                }`}
              >
                {h}
              </span>
            )
          )}
        </div>

        <div className="divide-y divide-slate-50">
          {scorecardClients.map((client) => {
            const lastJobColor =
              client.health === "at_risk"
                ? "text-red-500"
                : client.health === "attention"
                ? "text-amber-600"
                : "text-slate-500";

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="grid grid-cols-[1fr_150px_80px_80px_100px_80px_56px] gap-x-4 px-6 py-3.5 hover:bg-slate-50/80 transition-colors group"
              >
                {/* Name + URL */}
                <div className="min-w-0 self-center">
                  <div className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                    {client.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{client.url}</div>
                </div>

                {/* Health */}
                <div className="self-center">
                  <HealthBadge status={client.health} />
                </div>

                {/* New pages */}
                <div className="self-center text-center">
                  {client.newPages > 0 ? (
                    <Pill value={client.newPages} color="emerald" />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Refreshes */}
                <div className="self-center text-center">
                  {client.refreshesCount > 0 ? (
                    <Pill value={client.refreshesCount} color="blue" />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Last job */}
                <div className="self-center text-center">
                  <span className={`text-xs font-medium ${lastJobColor}`}>
                    {daysAgoLabel(client.lastJob)}
                  </span>
                </div>

                {/* Pending approvals */}
                <div className="self-center text-center">
                  {client.pending > 0 ? (
                    <Pill value={client.pending} color="amber" />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Month number */}
                <div className="self-center text-center">
                  {client.monthNum ? (
                    <span className="text-xs font-medium text-slate-400">M{client.monthNum}</span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              </Link>
            );
          })}

          {scorecardClients.length === 0 && (
            <div className="px-6 py-14 text-center text-slate-400 text-sm">
              No active clients yet.
            </div>
          )}
        </div>

        {/* Footer summary */}
        {scorecardClients.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center gap-6 text-xs text-slate-400">
            <span>{activeClients.length} active clients</span>
            <span>·</span>
            <span>
              <span className="font-semibold text-emerald-600">{healthCounts.healthy}</span> healthy ·{" "}
              <span className="font-semibold text-amber-500">{healthCounts.attention}</span> need attention ·{" "}
              <span className="font-semibold text-red-500">{healthCounts.at_risk}</span> at risk
            </span>
            <span className="ml-auto">
              {newPagesThisMonth + refreshesThisMonth} total deliverables published this month
            </span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Pill({ value, color }: { value: number; color: "emerald" | "blue" | "amber" }) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue:    "bg-blue-100 text-blue-700 border-blue-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold border ${styles[color]}`}
    >
      {value}
    </span>
  );
}

function StatBox({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-xl font-bold tabular-nums ${
          highlight ? "text-emerald-600" : warn ? "text-red-500" : "text-slate-800"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
