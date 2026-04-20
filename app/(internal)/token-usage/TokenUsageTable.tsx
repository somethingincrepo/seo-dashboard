"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { MonthlyClientRow } from "./page";

const SOP_LABELS: Record<string, string> = {
  implement: "Implement",
  month1_audit: "Month 1 Audit",
  month1_implement: "Month 1 Implement",
  ongoing_implement: "Implement",
  ongoing_publish: "Publish SEO",
  ongoing_monthly: "Monthly Review",
  report_generate: "Generate Report",
  onboarding_setup: "Onboarding Setup",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-slate-400",
  claimed: "text-blue-500",
  running: "text-blue-600",
  done: "text-emerald-600",
  failed: "text-red-500",
};

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TokenUsageTable({
  rows,
  months,
}: {
  rows: MonthlyClientRow[];
  months: string[];
}) {
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] ?? "");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => rows.filter((r) => !selectedMonth || r.month === selectedMonth),
    [rows, selectedMonth]
  );

  const monthTotal = useMemo(
    () => ({
      jobs: filtered.reduce((s, r) => s + r.jobCount, 0),
      inputTokens: filtered.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: filtered.reduce((s, r) => s + r.outputTokens, 0),
      costUsd: filtered.reduce((s, r) => s + r.costUsd, 0),
    }),
    [filtered]
  );

  function toggle(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Month filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">Month</span>
        <div className="flex gap-1.5 flex-wrap">
          {months.map((m) => {
            const label = formatMonthLabel(m);
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
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <GlassCard>
        {/* Header */}
        <div className="grid grid-cols-[1fr_5rem_10rem_10rem_8rem_2rem] gap-x-4 px-5 py-2.5 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Jobs</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Input Tokens</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Output Tokens</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cost</span>
          <span />
        </div>

        {/* Rows */}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            No jobs for this period.
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filtered.map((row) => {
            const key = `${row.clientId}::${row.month}`;
            const expanded = expandedKeys.has(key);
            return (
              <div key={key}>
                {/* Summary row */}
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="w-full grid grid-cols-[1fr_5rem_10rem_10rem_8rem_2rem] gap-x-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
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
                  <div className="self-center text-center text-slate-400 text-xs group-hover:text-slate-600 transition-colors">
                    {expanded ? "▲" : "▼"}
                  </div>
                </button>

                {/* Drill-down: individual jobs */}
                {expanded && (
                  <div className="bg-slate-50 border-t border-slate-100">
                    {/* Sub-header */}
                    <div className="grid grid-cols-[1fr_7rem_8rem_8rem_7rem_7rem] gap-x-4 px-8 py-2 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">SOP</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Input</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Output</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cost</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {row.jobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/jobs/${job.id}`}
                          className="grid grid-cols-[1fr_7rem_8rem_8rem_7rem_7rem] gap-x-4 px-8 py-2.5 hover:bg-slate-100 transition-colors"
                        >
                          <span className="text-xs text-slate-700 truncate self-center">
                            {SOP_LABELS[job.sopName] ?? job.sopName.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-slate-400 self-center">
                            {fmtDate(job.createdAt)}
                          </span>
                          <span className="text-xs text-slate-600 text-right tabular-nums self-center">
                            {fmtTokens(job.inputTokens)}
                          </span>
                          <span className="text-xs text-slate-600 text-right tabular-nums self-center">
                            {fmtTokens(job.outputTokens)}
                          </span>
                          <span className="text-xs font-medium text-slate-700 text-right tabular-nums self-center">
                            {fmtCost(job.costUsd)}
                          </span>
                          <span
                            className={`text-xs font-medium self-center ${STATUS_COLORS[job.status] ?? "text-slate-500"}`}
                          >
                            {job.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Totals footer */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-[1fr_5rem_10rem_10rem_8rem_2rem] gap-x-4 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <span className="text-xs font-semibold text-slate-500 self-center">
              {filtered.length} client{filtered.length !== 1 ? "s" : ""}
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
            <span />
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatMonthLabel(ym: string): string {
  const [year, mon] = ym.split("-");
  return `${MONTH_LABELS[mon] ?? mon} ${year}`;
}
