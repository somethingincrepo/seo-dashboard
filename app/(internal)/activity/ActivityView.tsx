"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { RevertActions } from "../reverts/RevertActions";
import type { ApprovalItem, JobItem, RevertItem, ClientInfo } from "./page";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "all" | "approvals" | "jobs" | "reverts";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  pending:  "text-slate-400",
  claimed:  "text-blue-500",
  running:  "text-blue-600",
  done:     "text-emerald-600",
  failed:   "text-red-500",
};

const CAT_COLORS: Record<string, string> = {
  "Technical":  "bg-slate-100 text-slate-600 border-slate-200",
  "On-Page":    "bg-blue-50 text-blue-700 border-blue-100",
  "Content":    "bg-violet-50 text-violet-700 border-violet-100",
  "AI-GEO":     "bg-amber-50 text-amber-700 border-amber-100",
};

const REVERT_STATUS: Record<string, { label: string; dot: string; text: string }> = {
  complete:      { label: "Live",          dot: "bg-emerald-500", text: "text-emerald-700" },
  reverting:     { label: "Reverting…",    dot: "bg-amber-400",   text: "text-amber-700"  },
  reverted:      { label: "Reverted",      dot: "bg-slate-400",   text: "text-slate-500"  },
  revert_failed: { label: "Revert failed", dot: "bg-red-500",     text: "text-red-600"    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActivityView({
  approvals,
  jobs,
  reverts,
  clients,
  byRecordId,
  bySlug,
}: {
  approvals: ApprovalItem[];
  jobs: JobItem[];
  reverts: RevertItem[];
  clients: ClientInfo[];
  byRecordId: Record<string, ClientInfo>;
  bySlug: Record<string, ClientInfo>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = (searchParams.get("tab") as Tab) ?? "all";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Sync tab to URL param so direct links work
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("tab");
    else params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30s so approvals and job status update without a manual reload
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Filtered sets
  const filteredApprovals = useMemo(
    () =>
      clientFilter === "all"
        ? approvals
        : approvals.filter((a) => a.clientRecordId === clientFilter),
    [approvals, clientFilter]
  );

  const filteredJobs = useMemo(() => {
    if (clientFilter === "all") return jobs;
    const info = byRecordId[clientFilter];
    if (!info) return [];
    return jobs.filter((j) => j.clientSlug === info.slug);
  }, [jobs, clientFilter, byRecordId]);

  const filteredReverts = useMemo(
    () =>
      clientFilter === "all"
        ? reverts
        : reverts.filter((r) => r.clientRecordId === clientFilter),
    [reverts, clientFilter]
  );

  // Counts for tab badges
  const appCount = filteredApprovals.length;
  const jobCount = filteredJobs.length;
  const revertCount = filteredReverts.length;

  const showApprovals = tab === "all" || tab === "approvals";
  const showJobs      = tab === "all" || tab === "jobs";
  const showReverts   = tab === "all" || tab === "reverts";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-slate-500 text-sm mt-1">
          Pending approvals, running jobs, and revertable changes — all in one place
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Client filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 font-medium shrink-0">Client</span>
          <button
            onClick={() => setClientFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              clientFilter === "all"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {clients.map((c) => (
            <button
              key={c.recordId}
              onClick={() => setClientFilter(c.recordId)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                clientFilter === c.recordId
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 border-b border-slate-100">
        {(
          [
            { key: "all",       label: "All" },
            { key: "approvals", label: "Approvals", count: appCount },
            { key: "jobs",      label: "Jobs",      count: jobCount },
            { key: "reverts",   label: "Reverts",   count: revertCount },
          ] as { key: Tab; label: string; count?: number }[]
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  tab === key
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Approvals section ─────────────────────────────────────────────── */}
      {showApprovals && (
        <Section
          title="Pending Approvals"
          count={appCount}
          emptyMsg="No pending approvals — all caught up!"
        >
          {/* Group by client */}
          {groupByClientId(filteredApprovals, "clientRecordId").map(([cid, items]) => {
            const clientName = byRecordId[cid]?.name ?? cid;
            return (
              <div key={cid}>
                <ClientSectionHeader name={clientName} count={items.length} />
                <GlassCard>
                  <div className="divide-y divide-slate-100">
                    {items.map((a) => (
                      <div key={a.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <CatBadge cat={a.cat} />
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {a.changeTitle || a.changeType}
                            </span>
                            {a.confidence && (
                              <span className="text-xs text-slate-400">{a.confidence}</span>
                            )}
                            {a.tier === "tier_1" && (
                              <span className="text-xs text-indigo-500 font-medium">Tier 1</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-1 truncate">
                          {a.pageUrl}
                        </div>
                        {a.proposedValue && (
                          <div className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {a.proposedValue}
                          </div>
                        )}
                        {a.reasoning && (
                          <div className="text-xs text-slate-400 mt-0.5 italic line-clamp-1">
                            {a.reasoning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Jobs section ──────────────────────────────────────────────────── */}
      {showJobs && (
        <Section
          title="Jobs"
          count={jobCount}
          emptyMsg="No recent jobs."
        >
          {groupByClientSlug(filteredJobs, bySlug).map(([cid, items]) => {
            const clientName = byRecordId[cid]?.name ?? bySlug[items[0].clientSlug]?.name ?? items[0].clientSlug;
            return (
              <div key={cid}>
                <ClientSectionHeader name={clientName} count={items.length} />
                <GlassCard>
                  {/* Sub-header */}
                  <div className="grid grid-cols-[1fr_7rem_8rem_8rem_6rem] gap-x-4 px-5 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">SOP</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Tokens</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cost</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.map((j) => (
                      <Link
                        key={j.id}
                        href={`/jobs/${j.id}`}
                        className="grid grid-cols-[1fr_7rem_8rem_8rem_6rem] gap-x-4 px-5 py-2.5 hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-slate-700 self-center truncate">
                          {SOP_LABELS[j.sopName] ?? j.sopName.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-slate-400 self-center">
                          {fmtDate(j.createdAt)}
                        </span>
                        <span className="text-xs text-slate-500 text-right tabular-nums self-center">
                          {fmtTokens(j.inputTokens + j.outputTokens)}
                        </span>
                        <span className="text-xs text-slate-600 text-right tabular-nums self-center">
                          {j.costUsd > 0 ? fmtCost(j.costUsd) : "—"}
                        </span>
                        <span className={`text-xs font-medium self-center ${STATUS_COLORS[j.status] ?? "text-slate-400"}`}>
                          {j.status}
                          {j.error && (
                            <span className="block text-red-400 text-[10px] truncate max-w-[6rem]">
                              {j.error}
                            </span>
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Reverts section ───────────────────────────────────────────────── */}
      {showReverts && (
        <Section
          title="Implemented Changes"
          count={revertCount}
          emptyMsg="No implemented changes yet."
        >
          {/* Group by status first, then by client */}
          {(["reverting", "complete", "revert_failed", "reverted"] as const).map((status) => {
            const statusItems = filteredReverts.filter(
              (r) => r.executionStatus === status
            );
            if (statusItems.length === 0) return null;
            const si = REVERT_STATUS[status];
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${si.dot}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${si.text}`}>
                    {si.label} ({statusItems.length})
                  </span>
                </div>
                {groupByClientId(statusItems, "clientRecordId").map(([cid, items]) => {
                  const clientName = byRecordId[cid]?.name ?? cid;
                  return (
                    <div key={cid}>
                      <ClientSectionHeader name={clientName} count={items.length} />
                      <div className="space-y-3">
                        {items.map((r) => (
                          <RevertCard key={r.id} item={r} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  count,
  emptyMsg,
  children,
}: {
  title: string;
  count: number;
  emptyMsg: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
        {title}
        {count > 0 && (
          <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </h2>
      {count === 0 ? (
        <GlassCard>
          <div className="px-5 py-10 text-center text-slate-400 text-sm">{emptyMsg}</div>
        </GlassCard>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </section>
  );
}

function ClientSectionHeader({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-semibold text-slate-700">{name}</span>
      <span className="text-xs text-slate-400">({count})</span>
    </div>
  );
}

function CatBadge({ cat }: { cat: string }) {
  const cls = CAT_COLORS[cat] ?? "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {cat}
    </span>
  );
}

function RevertCard({ item: r }: { item: RevertItem }) {
  const si = REVERT_STATUS[r.executionStatus] ?? REVERT_STATUS["complete"];
  return (
    <GlassCard>
      <div className="px-5 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CatBadge cat={r.cat} />
            <span className="text-sm font-semibold text-slate-800">
              {r.changeTitle || r.changeType}
            </span>
            <span className={`text-xs font-medium ${si.text}`}>{si.label}</span>
          </div>
          {r.cms && (
            <span className="text-xs text-slate-400 shrink-0">{r.cms}</span>
          )}
        </div>

        {/* URL */}
        <div className="text-xs text-slate-500 font-mono truncate">{r.pageUrl}</div>

        {/* Before / After */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-xs font-medium text-red-600 mb-1">Before</div>
            <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all line-clamp-3">
              {r.currentValue || "(empty)"}
            </div>
          </div>
          <div className={`rounded-lg p-3 ${r.executionStatus === "reverted" ? "bg-slate-50" : "bg-emerald-50"}`}>
            <div className={`text-xs font-medium mb-1 ${r.executionStatus === "reverted" ? "text-slate-400 line-through" : "text-emerald-700"}`}>
              {r.executionStatus === "reverted" ? "Implemented (reverted)" : "Implemented"}
            </div>
            <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all line-clamp-3">
              {r.proposedValue || "(empty)"}
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex gap-6 text-xs text-slate-400 flex-wrap">
          {r.implementedAt && <span>Implemented: {fmtDate(r.implementedAt)}</span>}
          {r.revertedAt && <span>Reverted: {fmtDate(r.revertedAt)}</span>}
        </div>
        {r.revertNote && (
          <div className="text-xs text-slate-500 italic">{r.revertNote}</div>
        )}

        {/* Actions */}
        <RevertActions
          changeId={r.id}
          executionStatus={r.executionStatus as "complete" | "reverting" | "reverted" | "revert_failed"}
          hasRevertPayload={r.hasRevertPayload}
        />
      </div>
    </GlassCard>
  );
}

// ─── Grouping utilities ───────────────────────────────────────────────────────

function groupByClientId<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const id = (item[key] as string) || "__none__";
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(item);
  }
  return [...map.entries()];
}

function groupByClientSlug(
  items: JobItem[],
  bySlug: Record<string, ClientInfo>
): [string, JobItem[]][] {
  // Group by slug but return keyed by recordId for consistent lookup
  const map = new Map<string, JobItem[]>();
  for (const item of items) {
    const info = bySlug[item.clientSlug];
    const key = info?.recordId ?? item.clientSlug;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()];
}
