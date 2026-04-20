"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { SopRow } from "./page";

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

function fmtDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function SopBreakdownTable({ rows }: { rows: SopRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(sopName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sopName)) next.delete(sopName);
      else next.add(sopName);
      return next;
    });
  }

  return (
    <GlassCard>
      {/* Header */}
      <div className="grid grid-cols-[1fr_5rem_10rem_10rem_8rem_2rem] gap-x-4 px-5 py-2.5 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Job Type</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Runs</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Input Tokens</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Output Tokens</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cost</span>
        <span />
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => {
          const isExpanded = expanded.has(row.sopName);
          return (
            <div key={row.sopName}>
              {/* SOP summary row */}
              <button
                type="button"
                onClick={() => toggle(row.sopName)}
                className="w-full grid grid-cols-[1fr_5rem_10rem_10rem_8rem_2rem] gap-x-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="min-w-0 self-center">
                  <div className="text-sm font-medium text-slate-800">
                    {row.sopLabel}
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
                  {isExpanded ? "▲" : "▼"}
                </div>
              </button>

              {/* Individual jobs */}
              {isExpanded && (
                <div className="bg-slate-50 border-t border-slate-100">
                  {/* Sub-header */}
                  <div className="grid grid-cols-[6rem_8rem_8rem_7rem_6rem_6rem] gap-x-4 px-8 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Run</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Started</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Input</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Output</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cost</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {row.jobs.map((job, i) => (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="grid grid-cols-[6rem_8rem_8rem_7rem_6rem_6rem] gap-x-4 px-8 py-2.5 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-xs text-slate-500 self-center font-mono">
                          #{i + 1}
                        </span>
                        <div className="self-center">
                          <div className="text-xs text-slate-600">
                            {fmtDate(job.createdAt)}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {fmtDuration(job.createdAt, job.finishedAt)}
                          </div>
                        </div>
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

      {/* Footer totals */}
      <div className="grid grid-cols-[1fr_5rem_10rem_10rem_8rem_2rem] gap-x-4 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
        <span className="text-xs font-semibold text-slate-500 self-center">
          {rows.length} job type{rows.length !== 1 ? "s" : ""}
        </span>
        <span className="text-xs font-semibold text-slate-700 text-right tabular-nums self-center">
          {rows.reduce((s, r) => s + r.jobCount, 0)}
        </span>
        <span className="text-xs font-semibold text-slate-700 text-right tabular-nums self-center">
          {fmtTokens(rows.reduce((s, r) => s + r.inputTokens, 0))}
        </span>
        <span className="text-xs font-semibold text-slate-700 text-right tabular-nums self-center">
          {fmtTokens(rows.reduce((s, r) => s + r.outputTokens, 0))}
        </span>
        <span className="text-sm font-bold text-slate-900 text-right tabular-nums self-center">
          {fmtCost(rows.reduce((s, r) => s + r.costUsd, 0))}
        </span>
        <span />
      </div>
    </GlassCard>
  );
}
