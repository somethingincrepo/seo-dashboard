"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GscLiveData = {
  connected: boolean;
  this?: { clicks: number; impressions: number; avg_position: number; ctr: number };
  prior?: { clicks: number; impressions: number; avg_position: number; ctr: number };
  trend?: { month_label: string; clicks: number; impressions: number; avg_position: number }[];
  top_queries?: { query: string; clicks: number; impressions: number; position: number }[];
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
};

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
    display = (delta >= 0 ? "+" : "") + fmtNum(Math.abs(delta));
    if (delta < 0) display = "−" + fmtNum(Math.abs(delta));
  }
  return (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      {display}
    </span>
  );
}

// ─── SVG Area Chart ───────────────────────────────────────────────────────────

function AreaChart({ values, labels }: { values: number[]; labels: string[] }) {
  if (values.length < 2) return null;
  const W = 500;
  const H = 72;
  const padX = 4;
  const padY = 6;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (W - padX * 2);
    const y = padY + (1 - v / max) * (H - padY * 2);
    return { x, y };
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${H - padY} L${pts[0].x},${H - padY} Z`;

  // Show label every 3 months
  const labelIndices = labels
    .map((_, i) => i)
    .filter((i) => i % 3 === 0 || i === labels.length - 1);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "72px" }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="gsc-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#gsc-area-grad)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots on each point */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#6366f1" opacity="0.6" />
        ))}
      </svg>
      {/* Month labels */}
      <div className="flex" style={{ marginTop: "2px" }}>
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

// ─── Position Sparkline (inverted: lower pos = better = higher on chart) ──────

function PositionSparkline({ points }: { points: { label: string; position: number }[] }) {
  if (points.length < 2) return null;
  const W = 120;
  const H = 32;
  const padX = 4;
  const padY = 4;
  const maxPos = Math.max(...points.map((p) => p.position), 1);
  // Smaller position number = better = drawn higher: y = (pos/max) * height
  const pts = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * (W - padX * 2),
    y: padY + (p.position / maxPos) * (H - padY * 2),
  }));
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const first = points[0].position;
  const last = points[points.length - 1].position;
  const stroke =
    last < first - 0.5 ? "#10b981" : last > first + 0.5 ? "#ef4444" : "#6366f1";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: "32px" }}
      preserveAspectRatio="none"
    >
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface ReportsLiveProps {
  token: string;
  initialGsc: GscLiveData | null;
}

export function ReportsLive({ initialGsc }: ReportsLiveProps) {
  const [queriesExpanded, setQueriesExpanded] = useState(false);

  const gsc = initialGsc;
  const trend = gsc?.trend ?? [];
  const queries = gsc?.top_queries ?? [];
  const visibleQueries = queriesExpanded ? queries : queries.slice(0, 5);

  return (
    <div className="space-y-5">

      {/* ── Live Search Performance ─────────────────────────────────────────── */}
      {gsc?.connected === false ? (
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">◎</div>
            <div>
              <div className="text-sm font-medium text-slate-700">Google Search Console not connected</div>
              <div className="text-xs text-slate-400 mt-0.5">Live performance data will appear here once GSC is linked in settings.</div>
            </div>
          </div>
        </GlassCard>
      ) : gsc?.connected ? (
        <GlassCard>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Live Performance</div>
              <div className="text-lg font-bold text-slate-900">Last 28 Days</div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold">
              Live
            </span>
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
                    <span className="text-[10px] text-slate-400">vs prior 28d</span>
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
                    <span className="text-[10px] text-slate-400">vs prior 28d</span>
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
                    <span className="text-[10px] text-slate-400">vs prior 28d</span>
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
                    <span className="text-[10px] text-slate-400">vs prior 28d</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trend chart */}
          {trend.length >= 3 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                12-Month Clicks Trend
              </div>
              <div className="relative pb-5">
                <AreaChart
                  values={trend.map((t) => t.clicks)}
                  labels={trend.map((t) => t.month_label)}
                />
              </div>
            </div>
          )}

          {/* Keyword position trends */}
          {gsc.keyword_trends && gsc.keyword_trends.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Keyword Position Trends
              </div>
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
                        kw.direction === "up"
                          ? "text-emerald-500"
                          : kw.direction === "down"
                          ? "text-red-400"
                          : "text-slate-300"
                      }`}
                    >
                      {kw.direction === "up" ? "↑" : kw.direction === "down" ? "↓" : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {/* Period axis labels — mirror the row layout */}
              <div className="flex items-center gap-3 mt-1">
                <span className="flex-1 min-w-0" />
                <div className="w-24 flex-shrink-0 flex justify-between">
                  {gsc.keyword_trends[0]?.points.map((p, i) => (
                    <span key={i} className="text-[9px] text-slate-300">{p.label}</span>
                  ))}
                </div>
                <span className="w-12" />
                <span className="w-4" />
              </div>
            </div>
          )}

          {/* Page performance gains / losses */}
          {((gsc.page_gaining?.length ?? 0) > 0 || (gsc.page_losing?.length ?? 0) > 0) && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Page Performance — Last 28 Days vs Prior
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Gaining */}
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
                          <span
                            className="text-xs text-slate-600 truncate"
                            title={p.page}
                          >
                            {shortPage(p.page)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Losing */}
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
                          <span
                            className="text-xs text-slate-600 truncate"
                            title={p.page}
                          >
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

          {/* Top queries */}
          {queries.length > 0 && (
            <div className="px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Top Queries
              </div>
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
                        <td className="px-3 py-2 text-slate-700 truncate max-w-[280px]">{q.query}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{fmtNum(q.clicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtNum(q.impressions)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${posColor(q.position)}`}>{fmtPos(q.position)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {queries.length > 5 && (
                <button
                  onClick={() => setQueriesExpanded(!queriesExpanded)}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  {queriesExpanded ? "Show less" : `Show all ${queries.length} queries`}
                </button>
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
                  Keywords showing — had no impressions in the last 28 days.
                </p>
              )}
            </div>
          )}
        </GlassCard>
      )}

    </div>
  );
}
