"use client";

import { useState, useRef, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GscLiveData = {
  connected: boolean;
  error_reason?: string;
  range_days?: number;
  this?: { clicks: number; impressions: number; avg_position: number; ctr: number };
  prior?: { clicks: number; impressions: number; avg_position: number; ctr: number };
  trend?: { month_label: string; clicks: number; impressions: number; avg_position: number }[];
  top_queries?: {
    query: string;
    clicks: number;
    impressions: number;
    position: number;
    is_target?: boolean;
    group?: string | null;
  }[];
  keyword_rankings?: {
    keyword: string;
    group: string;
    volume: number;
    difficulty: number;
    intent: string;
    position: number | null;
    clicks: number;
    impressions: number;
  }[];
  keyword_trends?: {
    keyword: string;
    points: { label: string; position: number }[];
    position: number;
    direction: "up" | "down" | "flat";
  }[];
  page_gaining?: { page: string; clicks_this: number; clicks_prior: number; delta: number }[];
  page_losing?: { page: string; clicks_this: number; clicks_prior: number; delta: number }[];
  brand_terms?: string[];
};

type DateRange = 28 | 90 | 180;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n * 100).toFixed(1) + "%";
}

function fmtPos(n: number) {
  return "#" + n.toFixed(1);
}

function isBrandQuery(query: string, brandTerms: string[]): boolean {
  const q = query.toLowerCase();
  return brandTerms.some((term) => q.includes(term));
}

function DeltaBadge({ current, prior, reverse = false, format = "num" }: {
  current: number;
  prior: number;
  reverse?: boolean;
  format?: "num" | "pct" | "pos";
}) {
  const delta = current - prior;
  if (delta === 0 || prior === 0) return null;
  const positive = reverse ? delta <= 0 : delta >= 0;
  const color = positive ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50";
  let display: string;
  if (format === "pct") {
    const pctChange = (delta / prior) * 100;
    display = (delta >= 0 ? "+" : "") + pctChange.toFixed(0) + "%";
  } else if (format === "pos") {
    display = (delta >= 0 ? "+" : "") + delta.toFixed(1);
  } else {
    display = (delta >= 0 ? "+" : "−") + fmtNum(Math.abs(delta));
  }
  return (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      {display}
    </span>
  );
}

// ─── Interactive SVG Area Chart ───────────────────────────────────────────────

function AreaChart({ values, labels, impressions }: {
  values: number[];
  labels: string[];
  impressions?: number[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 500;
  const H = 72;
  const padX = 4;
  const padY = 6;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (W - padX * 2),
    y: padY + (1 - v / max) * (H - padY * 2),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${H - padY} L${pts[0].x},${H - padY} Z`;

  const labelIndices = labels.map((_, i) => i).filter((i) => i % 3 === 0 || i === labels.length - 1);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const dataX = relX * W;
    // Find closest data point
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - dataX);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    setHovered(closest);
  }, [pts]);

  const hovPt = hovered !== null ? pts[hovered] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ height: "72px" }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="gsc-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#gsc-area-grad)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 3.5 : 2}
            fill={hovered === i ? "#4f46e5" : "#6366f1"}
            opacity={hovered === i ? 1 : 0.6} />
        ))}
        {/* Hover vertical line */}
        {hovPt && (
          <line
            x1={hovPt.x} y1={padY - 2} x2={hovPt.x} y2={H - padY + 2}
            stroke="#6366f1" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hovered !== null && hovPt && (
        <div
          className="absolute pointer-events-none z-10 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs"
          style={{
            left: `${(hovPt.x / W) * 100}%`,
            top: "0px",
            transform: hovPt.x / W > 0.75 ? "translateX(-100%)" : hovPt.x / W < 0.25 ? "translateX(0)" : "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-slate-800 mb-1">{labels[hovered]}</div>
          <div className="text-slate-600">
            <span className="font-medium text-indigo-700">{values[hovered].toLocaleString()}</span> clicks
          </div>
          {impressions && (
            <div className="text-slate-500">{impressions[hovered].toLocaleString()} impr.</div>
          )}
        </div>
      )}

      {/* Month labels */}
      <div className="relative h-5 mt-1">
        {labels.map((lbl, i) => {
          const show = labelIndices.includes(i);
          const left = `${(i / (labels.length - 1)) * 100}%`;
          return show ? (
            <div
              key={i}
              className="absolute text-[10px] text-slate-400 -translate-x-1/2"
              style={{ left }}
            >
              {lbl}
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DiffBadge({ score }: { score: number }) {
  const cls =
    score < 30
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score < 60
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-600 border-red-200";
  const label = score < 30 ? "Easy" : score < 60 ? "Medium" : "Hard";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cls}`}>
      {label} {score}
    </span>
  );
}

// ─── Position Color ───────────────────────────────────────────────────────────

function posColor(pos: number): string {
  if (pos <= 3) return "text-emerald-600 font-bold";
  if (pos <= 10) return "text-emerald-600";
  if (pos <= 20) return "text-amber-600";
  return "text-slate-400";
}

// ─── Position Sparkline ───────────────────────────────────────────────────────

function PositionSparkline({ points }: { points: { label: string; position: number }[] }) {
  if (points.length < 2) return null;
  const W = 120;
  const H = 32;
  const padX = 4;
  const padY = 4;
  const maxPos = Math.max(...points.map((p) => p.position), 1);
  const pts = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * (W - padX * 2),
    y: padY + (p.position / maxPos) * (H - padY * 2),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const first = points[0].position;
  const last = points[points.length - 1].position;
  const stroke = last < first - 0.5 ? "#10b981" : last > first + 0.5 ? "#ef4444" : "#6366f1";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "32px" }} preserveAspectRatio="none">
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill={stroke} opacity="0.7" />
      ))}
    </svg>
  );
}

// ─── Page URL display helper ──────────────────────────────────────────────────

function shortPage(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    if (!path) return "(homepage)";
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "(homepage)";
    if (parts.length === 1) return `/${parts[0]}`;
    return `/${parts.slice(-2).join("/")}`;
  } catch {
    return url;
  }
}

// ─── Range label helper ───────────────────────────────────────────────────────

function rangeLabel(days: DateRange): string {
  if (days === 28) return "Last 28 Days";
  if (days === 90) return "Last 90 Days";
  return "Last 6 Months";
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ReportsLiveProps {
  token: string;
  initialGsc: GscLiveData | null;
}

export function ReportsLive({ token, initialGsc }: ReportsLiveProps) {
  const [gsc, setGsc] = useState<GscLiveData | null>(initialGsc);
  const [dateRange, setDateRange] = useState<DateRange>(28);
  const [loading, setLoading] = useState(false);
  const [queriesExpanded, setQueriesExpanded] = useState(false);
  const [brandFilter, setBrandFilter] = useState<"all" | "brand" | "non-brand">("all");

  const brandTerms = gsc?.brand_terms ?? [];
  const allQueries = gsc?.top_queries ?? [];

  // Brand counts for filter tabs
  const brandCount = allQueries.filter((q) => isBrandQuery(q.query, brandTerms)).length;
  const nonBrandCount = allQueries.length - brandCount;

  const filteredQueries = allQueries.filter((q) => {
    if (brandFilter === "all") return true;
    const isBrand = isBrandQuery(q.query, brandTerms);
    return brandFilter === "brand" ? isBrand : !isBrand;
  });
  const visibleQueries = queriesExpanded ? filteredQueries : filteredQueries.slice(0, 5);

  const trend = gsc?.trend ?? [];

  async function fetchRange(range: DateRange) {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/reports/gsc-live?token=${encodeURIComponent(token)}&range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setGsc(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRangeChange(range: DateRange) {
    setDateRange(range);
    setQueriesExpanded(false);
    setBrandFilter("all");
    fetchRange(range);
  }

  return (
    <div className="space-y-5">

      {/* ── Live Search Performance ─────────────────────────────────────────── */}
      {gsc?.connected === false ? (
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">◎</div>
            <div>
              <div className="text-sm font-medium text-slate-700">
                {gsc.error_reason && gsc.error_reason !== "no_property"
                  ? "Google Search Console error"
                  : "Google Search Console not connected"}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {gsc.error_reason && gsc.error_reason !== "no_property"
                  ? gsc.error_reason
                  : "Live performance data will appear here once GSC is linked in settings."}
              </div>
            </div>
          </div>
        </GlassCard>
      ) : gsc?.connected ? (
        <GlassCard>
          {/* Header + date range toggle */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Live Performance</div>
              <div className="text-lg font-bold text-slate-900">
                {loading ? "Loading…" : rangeLabel(dateRange)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Date range tabs */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-semibold">
                {([28, 90, 180] as DateRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRangeChange(r)}
                    disabled={loading}
                    className={`px-3 py-1.5 transition-colors ${
                      dateRange === r
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {r === 28 ? "28d" : r === 90 ? "90d" : "6mo"}
                  </button>
                ))}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold">
                Live
              </span>
            </div>
          </div>

          {/* Metrics row */}
          {gsc.this && (
            <div className="px-5 pb-4 grid grid-cols-4 gap-4 border-b border-slate-100">
              {/* Clicks */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Clicks</div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{fmtNum(gsc.this.clicks)}</div>
                {gsc.prior && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <DeltaBadge current={gsc.this.clicks} prior={gsc.prior.clicks} format="pct" />
                    <span className="text-[10px] text-slate-400">vs prior</span>
                  </div>
                )}
              </div>
              {/* Impressions */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Impressions</div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{fmtNum(gsc.this.impressions)}</div>
                {gsc.prior && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <DeltaBadge current={gsc.this.impressions} prior={gsc.prior.impressions} format="pct" />
                    <span className="text-[10px] text-slate-400">vs prior</span>
                  </div>
                )}
              </div>
              {/* Avg Position */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Avg Position</div>
                <div className={`text-2xl font-bold tabular-nums ${posColor(gsc.this.avg_position)}`}>
                  {fmtPos(gsc.this.avg_position)}
                </div>
                {gsc.prior && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <DeltaBadge current={gsc.this.avg_position} prior={gsc.prior.avg_position} reverse format="pos" />
                    <span className="text-[10px] text-slate-400">vs prior</span>
                  </div>
                )}
              </div>
              {/* CTR */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">CTR</div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{fmtPct(gsc.this.ctr)}</div>
                {gsc.prior && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <DeltaBadge current={gsc.this.ctr} prior={gsc.prior.ctr} format="pct" />
                    <span className="text-[10px] text-slate-400">vs prior</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trend chart — always 12-month regardless of range selection */}
          {trend.length >= 3 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                12-Month Clicks Trend
              </div>
              <AreaChart
                values={trend.map((t) => t.clicks)}
                labels={trend.map((t) => t.month_label)}
                impressions={trend.map((t) => t.impressions)}
              />
            </div>
          )}

          {/* Keyword position trajectory */}
          {gsc.keyword_trends && gsc.keyword_trends.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Keyword Position Trajectory
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 mb-3">
                Position over time — lower is better
              </div>
              {/* Period legend */}
              {gsc.keyword_trends[0]?.points && (
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  {gsc.keyword_trends[0].points.map((p, i) => {
                    const isLast = i === gsc.keyword_trends![0].points.length - 1;
                    const dotColor = isLast ? "#6366f1" : "#94a3b8";
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="3" fill={dotColor} />
                        </svg>
                        <span className={`text-[10px] font-semibold ${isLast ? "text-indigo-600" : "text-slate-400"}`}>
                          {p.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="space-y-2.5">
                {gsc.keyword_trends.map((kw, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 truncate min-w-0 flex-1">{kw.keyword}</span>
                    <div className="w-24 flex-shrink-0">
                      <PositionSparkline points={kw.points} />
                    </div>
                    <span className={`text-sm font-semibold tabular-nums w-12 text-right ${posColor(kw.position)}`}>
                      #{kw.position.toFixed(1)}
                    </span>
                    <span
                      className={`text-xs font-bold w-4 text-right ${
                        kw.direction === "up" ? "text-emerald-500"
                        : kw.direction === "down" ? "text-red-400"
                        : "text-slate-300"
                      }`}
                    >
                      {kw.direction === "up" ? "↑" : kw.direction === "down" ? "↓" : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Page performance gains / losses */}
          {((gsc.page_gaining?.length ?? 0) > 0 || (gsc.page_losing?.length ?? 0) > 0) && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Page Performance — vs Prior Period
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-semibold text-emerald-600 mb-2">Top gaining pages</div>
                  {(gsc.page_gaining?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-400">No pages gained traffic this period.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {gsc.page_gaining!.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-emerald-500 font-semibold text-xs w-8 text-right flex-shrink-0">
                            +{fmtNum(p.delta)}
                          </span>
                          <span className="text-xs text-slate-600 truncate" title={p.page}>
                            {shortPage(p.page)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-red-500 mb-2">Pages losing traffic</div>
                  {(gsc.page_losing?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-400">No pages lost traffic this period.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {gsc.page_losing!.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-red-400 font-semibold text-xs w-8 text-right flex-shrink-0">
                            {fmtNum(p.delta)}
                          </span>
                          <span className="text-xs text-slate-600 truncate" title={p.page}>
                            {shortPage(p.page)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top queries with brand filter */}
          {allQueries.length > 0 && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Top Queries
                </div>
                {/* Brand / Non-brand filter — only show if we have brand terms */}
                {brandTerms.length > 0 && (
                  <div className="flex rounded-md border border-slate-200 overflow-hidden text-[10px] font-semibold">
                    {(["all", "brand", "non-brand"] as const).map((f) => {
                      const count = f === "all" ? allQueries.length : f === "brand" ? brandCount : nonBrandCount;
                      return (
                        <button
                          key={f}
                          onClick={() => { setBrandFilter(f); setQueriesExpanded(false); }}
                          className={`px-2.5 py-1 transition-colors capitalize ${
                            brandFilter === f
                              ? "bg-indigo-600 text-white"
                              : "bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {f} <span className="opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {filteredQueries.length === 0 ? (
                <p className="text-xs text-slate-400">No {brandFilter} queries in this period.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Query</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Clicks</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Impr.</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {visibleQueries.map((q, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 max-w-[280px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-700 truncate">{q.query}</span>
                                {q.is_target && q.group && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold whitespace-nowrap flex-shrink-0">
                                    {q.group}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{fmtNum(q.clicks)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtNum(q.impressions)}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${posColor(q.position)}`}>{fmtPos(q.position)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredQueries.length > 5 && (
                    <button
                      onClick={() => setQueriesExpanded(!queriesExpanded)}
                      className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      {queriesExpanded ? "Show less" : `Show all ${filteredQueries.length} queries`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </GlassCard>
      ) : null}

      {/* ── Keyword Rankings ──────────────────────────────────────────────── */}
      {gsc?.connected && (
        <GlassCard>
          <div className="px-5 pt-5 pb-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Keyword Intelligence</div>
            <div className="text-lg font-bold text-slate-900">Target Keyword Rankings</div>
          </div>

          {!gsc.keyword_rankings || gsc.keyword_rankings.length === 0 ? (
            <div className="px-5 pb-5">
              <p className="text-sm text-slate-500">
                No keyword groups configured yet. Add keyword groups in your content pipeline to see live position tracking here.
              </p>
            </div>
          ) : (
            <div className="px-5 pb-5">
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Keyword</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Position</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Clicks</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Volume</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">KD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {gsc.keyword_rankings.map((kw, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="text-slate-700 font-medium">{kw.keyword}</div>
                          {kw.group && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{kw.group}</div>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${kw.position != null ? posColor(kw.position) : "text-slate-300"}`}>
                          {kw.position != null ? fmtPos(kw.position) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {kw.clicks > 0 ? fmtNum(kw.clicks) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {kw.volume > 0 ? fmtNum(kw.volume) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {kw.difficulty > 0 ? (
                            <DiffBadge score={kw.difficulty} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {gsc.keyword_rankings.some((kw) => kw.position == null) && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Keywords showing — had no impressions in the last {dateRange === 28 ? "28 days" : dateRange === 90 ? "90 days" : "6 months"}.
                </p>
              )}
            </div>
          )}
        </GlassCard>
      )}

    </div>
  );
}
