"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import type { MonthlyClientRow } from "./page";

type SortKey = "clientName" | "jobCount" | "inputTokens" | "outputTokens" | "costUsd";
type SortDir = "asc" | "desc";

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatMonthLabel(ym: string): string {
  const [year, mon] = ym.split("-");
  return `${MONTH_LABELS[mon] ?? mon} ${year}`;
}

export function TokenUsageTable({
  rows,
  months,
}: {
  rows: MonthlyClientRow[];
  months: string[];
}) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("costUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(
    () => rows.filter((r) => !selectedMonth || r.month === selectedMonth),
    [rows, selectedMonth]
  );

  const displayed = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
  }, [filtered, sortKey, sortDir]);

  const monthTotal = useMemo(
    () => ({
      jobs: filtered.reduce((s, r) => s + r.jobCount, 0),
      inputTokens: filtered.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: filtered.reduce((s, r) => s + r.outputTokens, 0),
      costUsd: filtered.reduce((s, r) => s + r.costUsd, 0),
    }),
    [filtered]
  );

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="text-slate-300 ml-1">↕</span>;
    return (
      <span className="text-indigo-500 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
    );
  }

  function ColHeader({
    label,
    k,
    right,
  }: {
    label: string;
    k: SortKey;
    right?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={() => handleSort(k)}
        className={`flex items-center gap-0 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${right ? "ml-auto" : ""}`}
      >
        {label}
        {sortIcon(k)}
      </button>
    );
  }

  const SORT_PRESETS: { label: string; key: SortKey; dir: SortDir }[] = [
    { label: "Highest cost",    key: "costUsd",       dir: "desc" },
    { label: "Lowest cost",     key: "costUsd",       dir: "asc"  },
    { label: "Most output",     key: "outputTokens",  dir: "desc" },
    { label: "Most input",      key: "inputTokens",   dir: "desc" },
    { label: "Most jobs",       key: "jobCount",      dir: "desc" },
    { label: "Client A–Z",      key: "clientName",    dir: "asc"  },
  ];

  return (
    <div className="space-y-4">
      {/* Sort presets */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-500 font-medium shrink-0">Sort</span>
        <div className="flex gap-1.5 flex-wrap">
          {SORT_PRESETS.map((p) => {
            const active = sortKey === p.key && sortDir === p.dir;
            return (
              <button
                key={p.label}
                onClick={() => { setSortKey(p.key); setSortDir(p.dir); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">Month</span>
        <div className="flex gap-1.5 flex-wrap">
          {months.map((m) => {
            const active = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {formatMonthLabel(m)}
              </button>
            );
          })}
        </div>
      </div>

      <GlassCard>
        {/* Header */}
        <div className="grid grid-cols-[1fr_5rem_10rem_10rem_8rem] gap-x-4 px-5 py-2.5 border-b border-slate-100">
          <ColHeader label="Client" k="clientName" />
          <div className="flex justify-end">
            <ColHeader label="Jobs" k="jobCount" right />
          </div>
          <div className="flex justify-end">
            <ColHeader label="Input Tokens" k="inputTokens" right />
          </div>
          <div className="flex justify-end">
            <ColHeader label="Output Tokens" k="outputTokens" right />
          </div>
          <div className="flex justify-end">
            <ColHeader label="Cost" k="costUsd" right />
          </div>
        </div>

        {displayed.length === 0 && (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            No jobs for this period.
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {displayed.map((row) => {
            const key = `${row.clientId}::${row.month}`;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  router.push(
                    `/token-usage/${encodeURIComponent(row.clientId)}/${row.month}`
                  )
                }
                className="w-full grid grid-cols-[1fr_5rem_10rem_10rem_8rem] gap-x-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                    {row.clientName}
                  </div>
                  {row.failedCount > 0 && (
                    <div className="text-xs text-red-500 mt-0.5">
                      {row.failedCount} failed
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-600 text-right tabular-nums self-center">
                  {row.jobCount}
                </div>
                <div className="text-sm text-slate-600 text-right tabular-nums self-center">
                  {fmtTokens(row.inputTokens)}
                </div>
                <div className="text-sm text-slate-600 text-right tabular-nums self-center">
                  {fmtTokens(row.outputTokens)}
                </div>
                <div className="text-sm font-semibold text-slate-800 text-right tabular-nums self-center">
                  {fmtCost(row.costUsd)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Totals footer */}
        {displayed.length > 0 && (
          <div className="grid grid-cols-[1fr_5rem_10rem_10rem_8rem] gap-x-4 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <span className="text-xs font-semibold text-slate-500 self-center">
              {displayed.length} client{displayed.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold text-slate-700 text-right tabular-nums self-center">
              {monthTotal.jobs}
            </span>
            <span className="text-xs font-semibold text-slate-700 text-right tabular-nums self-center">
              {fmtTokens(monthTotal.inputTokens)}
            </span>
            <span className="text-xs font-semibold text-slate-700 text-right tabular-nums self-center">
              {fmtTokens(monthTotal.outputTokens)}
            </span>
            <span className="text-sm font-bold text-slate-900 text-right tabular-nums self-center">
              {fmtCost(monthTotal.costUsd)}
            </span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
