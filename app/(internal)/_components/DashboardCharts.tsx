import { cn } from "@/lib/utils";

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

const KPI_ACCENTS = {
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-100/80",  label: "text-indigo-500",  val: "text-indigo-900"  },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-100/80", label: "text-emerald-600", val: "text-emerald-900" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-100/80",    label: "text-blue-500",    val: "text-blue-900"    },
  amber:   { bg: "bg-amber-50",   border: "border-amber-100/80",   label: "text-amber-600",   val: "text-amber-900"   },
  violet:  { bg: "bg-violet-50",  border: "border-violet-100/80",  label: "text-violet-500",  val: "text-violet-900"  },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",      label: "text-slate-400",   val: "text-slate-700"   },
};

export function KpiTile({
  label,
  value,
  sub,
  accent = "slate",
  icon,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof typeof KPI_ACCENTS;
  icon?: string;
  href?: string;
}) {
  const a = KPI_ACCENTS[accent];
  const inner = (
    <div className={cn("rounded-2xl border px-5 py-5 h-full flex flex-col justify-between", a.bg, a.border)}>
      <div className="flex items-start justify-between">
        <span className={cn("text-[10px] font-bold uppercase tracking-widest", a.label)}>{label}</span>
        {icon && <span className="text-base opacity-50">{icon}</span>}
      </div>
      <div>
        <div className={cn("text-3xl font-bold tabular-nums leading-none mt-3", a.val)}>{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-2">{sub}</div>}
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block hover:opacity-90 transition-opacity">
        {inner}
      </a>
    );
  }
  return inner;
}

// ─── Pipeline Funnel ─────────────────────────────────────────────────────────

export type FunnelStage = {
  label: string;
  count: number;
  color: string;
};

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = stages[0]?.count || 1;
  return (
    <div className="space-y-2.5">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const convPct = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
        const widthPct = Math.max((stage.count / max) * 100, 4);
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="w-32 text-xs text-slate-400 text-right shrink-0 leading-tight">{stage.label}</span>
            <div className="flex-1 h-8 relative rounded-lg bg-slate-50 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-lg"
                style={{ width: `${widthPct}%`, background: stage.color }}
              />
              <div className="absolute inset-0 flex items-center gap-2 pl-3">
                <span className="text-xs font-bold text-white drop-shadow-sm">
                  {stage.count.toLocaleString()}
                </span>
                {convPct !== null && (
                  <span className="text-[11px] text-white/70 drop-shadow-sm">{convPct}%</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cost Trend Bar Chart ─────────────────────────────────────────────────────

export type DayCost = { day: string; cost: number };

export function CostTrendChart({ data }: { data: DayCost[] }) {
  const maxCost = Math.max(...data.map((d) => d.cost), 0.00001);
  const nonZero = data.filter((d) => d.cost > 0).length;
  return (
    <div>
      <div className="flex items-end gap-[2px] h-20 px-0.5">
        {data.map((d, i) => {
          const heightPct = (d.cost / maxCost) * 100;
          const isToday = i === data.length - 1;
          const isWeekend = new Date(d.day + "T12:00:00Z").getUTCDay() % 6 === 0;
          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col justify-end"
              title={`${d.day}: $${d.cost.toFixed(5)}`}
            >
              <div
                className={cn(
                  "w-full rounded-[2px]",
                  d.cost === 0
                    ? "bg-slate-100"
                    : isToday
                    ? "bg-indigo-600"
                    : isWeekend
                    ? "bg-indigo-200"
                    : "bg-indigo-400"
                )}
                style={{ height: d.cost === 0 ? "3px" : `${Math.max(heightPct, 8)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>{data[0]?.day.slice(5).replace("-", "/")}</span>
        <span>
          {nonZero} active days · <span className="font-medium text-slate-500">${data.reduce((s, d) => s + d.cost, 0).toFixed(4)}</span>
        </span>
        <span>{data[data.length - 1]?.day.slice(5).replace("-", "/")}</span>
      </div>
    </div>
  );
}

// ─── SOP Frequency Bars ───────────────────────────────────────────────────────

export type SopEntry = { name: string; count: number };

function formatSopName(raw: string): string {
  return raw
    .replace(/^sop[_-]?\d+[_-]?/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || raw;
}

export function SopFreqChart({ sops }: { sops: SopEntry[] }) {
  const max = sops[0]?.count || 1;
  if (sops.length === 0) {
    return <div className="text-xs text-slate-400 text-center py-8">No jobs this month</div>;
  }
  return (
    <div className="space-y-2">
      {sops.map((sop, i) => {
        const widthPct = Math.max((sop.count / max) * 100, 8);
        const shades = [
          "bg-violet-500", "bg-violet-400", "bg-violet-400",
          "bg-violet-300", "bg-violet-300", "bg-violet-200",
          "bg-violet-200", "bg-violet-100",
        ];
        return (
          <div key={sop.name} className="flex items-center gap-3">
            <span className="w-28 text-[11px] text-slate-400 truncate shrink-0 text-right">{formatSopName(sop.name)}</span>
            <div className="flex-1 h-6 relative rounded bg-slate-50 overflow-hidden">
              <div
                className={cn("absolute inset-y-0 left-0 rounded", shades[i] ?? "bg-violet-200")}
                style={{ width: `${widthPct}%` }}
              />
              <div className="absolute inset-0 flex items-center pl-2.5">
                <span className="text-[11px] font-semibold text-white drop-shadow-sm">{sop.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Job Status Donut (conic-gradient) ───────────────────────────────────────

export function StatusDonut({
  done,
  failed,
  active,
}: {
  done: number;
  failed: number;
  active: number;
}) {
  const total = done + failed + active;
  const safeTotal = total || 1;
  const donePct  = (done   / safeTotal) * 100;
  const activePct = (active / safeTotal) * 100;
  // failed takes the remainder

  const gradient =
    total === 0
      ? "#e2e8f0"
      : `conic-gradient(
          #10b981 0% ${donePct}%,
          #3b82f6 ${donePct}% ${donePct + activePct}%,
          #f87171 ${donePct + activePct}% 100%
        )`;

  const successRate = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="w-[88px] h-[88px] rounded-full" style={{ background: gradient }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[56px] h-[56px] bg-white rounded-full flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-slate-800 leading-none">{successRate}%</span>
            <span className="text-[9px] text-slate-400 leading-none mt-0.5">success</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 flex-1">
        <LegendRow color="bg-emerald-500" label="Done"   value={done}   total={safeTotal} />
        <LegendRow color="bg-blue-500"    label="Active" value={active} total={safeTotal} />
        <LegendRow color="bg-red-400"     label="Failed" value={failed} total={safeTotal} />
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={cn("w-2 h-2 rounded-full shrink-0", color)} />
      <span className="text-slate-500 w-10">{label}</span>
      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-semibold text-slate-700 tabular-nums w-8 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

// ─── Client Health Badge ──────────────────────────────────────────────────────

const HEALTH_STYLES = {
  healthy:    { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Healthy" },
  attention:  { dot: "bg-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",   label: "Needs Attention" },
  at_risk:    { dot: "bg-red-400",     bg: "bg-red-50",     text: "text-red-700",     label: "At Risk" },
};

export function HealthBadge({ status }: { status: "healthy" | "attention" | "at_risk" }) {
  const s = HEALTH_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", s.bg, s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

// ─── Content Refresh Funnel (separate from page creation) ─────────────────────

export type RefreshFunnelStage = { label: string; count: number; color: string };

export function RefreshFunnelChart({ stages }: { stages: RefreshFunnelStage[] }) {
  return <FunnelChart stages={stages} />;
}

// ─── Health Distribution Mini-Chart ───────────────────────────────────────────

export function HealthDistribution({
  healthy,
  attention,
  atRisk,
  total,
}: {
  healthy: number;
  attention: number;
  atRisk: number;
  total: number;
}) {
  const safeTotal = total || 1;
  const segments = [
    { pct: (healthy   / safeTotal) * 100, color: "bg-emerald-400", label: `${healthy} healthy` },
    { pct: (attention / safeTotal) * 100, color: "bg-amber-400",   label: `${attention} attention` },
    { pct: (atRisk    / safeTotal) * 100, color: "bg-red-400",     label: `${atRisk} at risk` },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {segments.map((seg, i) =>
          seg.pct > 0 ? (
            <div
              key={i}
              className={cn("h-full rounded-full", seg.color)}
              style={{ width: `${seg.pct}%` }}
              title={seg.label}
            />
          ) : null
        )}
      </div>
      <div className="flex gap-3">
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className={cn("w-1.5 h-1.5 rounded-full", seg.color)} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
