import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Portal KPI Tile ─────────────────────────────────────────────────────────

const KPI_ACCENTS = {
  amber:   { bg: "bg-amber-50",   border: "border-amber-100",   label: "text-amber-600",  val: "text-amber-900",  icon: "text-amber-400" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-100", label: "text-emerald-600",val: "text-emerald-900",icon: "text-emerald-400" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-100",  label: "text-indigo-600", val: "text-indigo-900", icon: "text-indigo-400" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-100",    label: "text-rose-600",   val: "text-rose-900",   icon: "text-rose-400" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   label: "text-slate-500",  val: "text-slate-700",  icon: "text-slate-300" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-100",  label: "text-violet-600", val: "text-violet-900", icon: "text-violet-400" },
};

export function PortalKpiTile({
  label,
  value,
  sub,
  accent = "slate",
  href,
  cta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof typeof KPI_ACCENTS;
  href?: string;
  cta?: string;
}) {
  const a = KPI_ACCENTS[accent];
  const content = (
    <div className={cn("rounded-2xl border h-full flex flex-col justify-between px-5 py-5", a.bg, a.border, href && "hover:opacity-90 transition-opacity cursor-pointer")}>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", a.label)}>{label}</span>
      <div>
        <div className={cn("text-4xl font-bold tabular-nums leading-none mt-2", a.val)}>{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-2 leading-relaxed">{sub}</div>}
        {cta && href && (
          <div className={cn("mt-3 text-xs font-semibold", a.label)}>{cta} →</div>
        )}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{content}</Link>;
  return content;
}

// ─── Action Items Card ────────────────────────────────────────────────────────

export type ActionItem = {
  label: string;
  count: number;
  href: string;
  accent: "amber" | "indigo" | "violet" | "emerald" | "rose";
  description: string;
};

const ACTION_COLORS = {
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   count: "bg-amber-500",   text: "text-amber-900",   sub: "text-amber-600",   hover: "hover:border-amber-300 hover:bg-amber-100/60" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  count: "bg-indigo-500",  text: "text-indigo-900",  sub: "text-indigo-600",  hover: "hover:border-indigo-300 hover:bg-indigo-100/60" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  count: "bg-violet-500",  text: "text-violet-900",  sub: "text-violet-600",  hover: "hover:border-violet-300 hover:bg-violet-100/60" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", count: "bg-emerald-500", text: "text-emerald-900", sub: "text-emerald-600", hover: "hover:border-emerald-300 hover:bg-emerald-100/60" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    count: "bg-rose-500",    text: "text-rose-900",    sub: "text-rose-600",    hover: "hover:border-rose-300 hover:bg-rose-100/60" },
};

export function ActionItemsCard({
  items,
  token,
}: {
  items: ActionItem[];
  token: string;
}) {
  const active = items.filter((i) => i.count > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Your Review Queue</h3>
        {active.length > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
            {active.length}
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">You&rsquo;re all caught up</p>
          <p className="text-xs text-slate-400 mt-1">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {active.map((item) => {
            const c = ACTION_COLORS[item.accent];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl border transition-all",
                  c.bg, c.border, c.hover
                )}
              >
                <span className={cn("inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg text-sm font-bold text-white", c.count)}>
                  {item.count}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium leading-tight", c.text)}>{item.label}</div>
                  <div className={cn("text-[11px] mt-0.5 leading-tight", c.sub)}>{item.description}</div>
                </div>
                <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <Link
            href={`/portal/${token}/approvals`}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            View all approvals
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── GSC Trend Chart ─────────────────────────────────────────────────────────

export type GscWeek = {
  week_start: string;
  clicks: number;
  impressions: number;
  avg_position: number | null;
};

export function GscTrendChart({ weeks }: { weeks: GscWeek[] }) {
  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="text-sm text-slate-400">No traffic data yet</div>
        <div className="text-xs text-slate-300 mt-1">GSC data will appear after your first full week of tracking.</div>
      </div>
    );
  }

  const ordered = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const maxClicks = Math.max(...ordered.map((w) => w.clicks), 1);
  const maxImpressions = Math.max(...ordered.map((w) => w.impressions), 1);
  const totalClicks = ordered.reduce((s, w) => s + w.clicks, 0);
  const totalImpressions = ordered.reduce((s, w) => s + w.impressions, 0);
  const latestPosition = ordered[ordered.length - 1]?.avg_position;

  const fmtNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const weekLabel = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  };

  return (
    <div>
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">Total Clicks</div>
          <div className="text-xl font-bold text-slate-800 tabular-nums">{fmtNum(totalClicks)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">last {ordered.length} weeks</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">Impressions</div>
          <div className="text-xl font-bold text-slate-800 tabular-nums">{fmtNum(totalImpressions)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">last {ordered.length} weeks</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">Avg. Position</div>
          <div className="text-xl font-bold text-slate-800 tabular-nums">
            {latestPosition != null ? latestPosition.toFixed(1) : "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">latest week</div>
        </div>
      </div>

      {/* Dual bar chart: impressions behind, clicks in front */}
      <div className="relative">
        <div className="flex items-end gap-[3px] h-24">
          {ordered.map((w, i) => {
            const clickPct = (w.clicks / maxClicks) * 100;
            const impPct = (w.impressions / maxImpressions) * 100;
            const isLast = i === ordered.length - 1;
            return (
              <div
                key={w.week_start}
                className="flex-1 flex flex-col justify-end gap-0 relative"
                title={`${weekLabel(w.week_start)}: ${w.clicks.toLocaleString()} clicks, ${w.impressions.toLocaleString()} impressions`}
              >
                {/* Impressions bar (light, behind) */}
                <div
                  className="w-full absolute bottom-0 rounded-sm"
                  style={{
                    height: `${Math.max(impPct, 4)}%`,
                    background: isLast ? "rgba(99,102,241,0.15)" : "rgba(148,163,184,0.15)",
                  }}
                />
                {/* Clicks bar (front) */}
                <div
                  className={cn("w-full rounded-sm relative z-10", isLast ? "bg-indigo-500" : "bg-indigo-300")}
                  style={{ height: `${Math.max(clickPct, 6)}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels — show first, middle, last */}
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
          <span>{weekLabel(ordered[0].week_start)}</span>
          {ordered.length > 2 && (
            <span>{weekLabel(ordered[Math.floor(ordered.length / 2)].week_start)}</span>
          )}
          <span>{weekLabel(ordered[ordered.length - 1].week_start)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-indigo-300 inline-block" /> Clicks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-slate-200 inline-block" /> Impressions (scaled)
        </span>
      </div>
    </div>
  );
}

// ─── Content Pipeline Funnel ─────────────────────────────────────────────────

export type ClientFunnelStage = {
  label: string;
  count: number;
  color: string;
  description: string;
};

export function ClientPipelineFunnel({ stages, title, total }: { stages: ClientFunnelStage[]; title: string; total: number }) {
  const max = stages[0]?.count || 1;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{total} total suggested</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold">
          {stages[stages.length - 1]?.count ?? 0} live
        </span>
      </div>

      <div className="space-y-2">
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1].count : null;
          const convPct = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
          const widthPct = Math.max((stage.count / max) * 100, 6);
          return (
            <div key={stage.label}>
              <div className="flex items-center gap-2.5">
                <span className="w-28 text-[11px] text-slate-400 text-right shrink-0 leading-tight">{stage.label}</span>
                <div className="flex-1 h-7 relative rounded-lg bg-slate-50 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg"
                    style={{ width: `${widthPct}%`, background: stage.color }}
                  />
                  <div className="absolute inset-0 flex items-center gap-1.5 pl-2.5">
                    <span className="text-xs font-bold text-white drop-shadow-sm">{stage.count}</span>
                    {convPct !== null && (
                      <span className="text-[10px] text-white/70 drop-shadow-sm">{convPct}%</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-[7.5rem] pl-2.5 mt-0.5">
                <span className="text-[10px] text-slate-400">{stage.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Monthly Deliverable Progress Bars ────────────────────────────────────────

export type DeliverableRow = {
  label: string;
  actual: number;
  target: number;
  color: string;
};

export function DeliverableProgress({ rows, monthLabel }: { rows: DeliverableRow[]; monthLabel: string }) {
  const allDone = rows.every((r) => r.actual >= r.target);
  const totalActual = rows.reduce((s, r) => s + Math.min(r.actual, r.target), 0);
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Monthly Progress</h3>
          <p className="text-xs text-slate-400 mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full" style={{ background: `conic-gradient(#6366f1 0% ${overallPct}%, #e2e8f0 ${overallPct}% 100%)` }}>
            <div className="absolute inset-1 bg-white rounded-full" />
          </div>
          <span className="text-sm font-bold text-slate-700">{overallPct}%</span>
        </div>
      </div>

      {allDone && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-xs font-medium text-emerald-700">All deliverables complete for this month!</span>
        </div>
      )}

      <div className="space-y-3.5">
        {rows.map((row) => {
          const pct = row.target > 0 ? Math.min(100, Math.round((row.actual / row.target) * 100)) : 100;
          const done = row.actual >= row.target;
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-slate-600">{row.label}</span>
                <span className={cn("text-[12px] font-semibold tabular-nums", done ? "text-emerald-600" : "text-slate-500")}>
                  {row.actual}
                  <span className="text-slate-300 font-normal"> / {row.target}</span>
                  {done && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold">✓</span>}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: done ? "#10b981" : row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recent Changes Timeline ──────────────────────────────────────────────────

export type RecentChange = {
  label: string;
  type: string;
  date: string | null;
  status: "implemented" | "approved" | "pending";
};

export function RecentChangesTimeline({ changes }: { changes: RecentChange[] }) {
  if (changes.length === 0) {
    return <div className="text-xs text-slate-400 py-4 text-center">No recent changes yet.</div>;
  }

  const statusStyles = {
    implemented: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Live" },
    approved:    { dot: "bg-blue-500",    text: "text-blue-600",    label: "Queued" },
    pending:     { dot: "bg-amber-400",   text: "text-amber-600",   label: "Pending" },
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-0 divide-y divide-slate-50">
      {changes.map((c, i) => {
        const s = statusStyles[c.status];
        return (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-slate-700 truncate leading-tight">{c.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{c.type}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={cn("text-[10px] font-semibold", s.text)}>{s.label}</div>
              {c.date && <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(c.date)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
