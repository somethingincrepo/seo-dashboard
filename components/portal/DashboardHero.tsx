"use client";

import Link from "next/link";

interface DashboardHeroProps {
  pendingCount: number;
  approvedCount: number;
  implementedCount: number;
  token: string;
  contactName: string;
  status: string;
}

export function DashboardHero({
  pendingCount,
  approvedCount,
  implementedCount,
  token,
}: DashboardHeroProps) {
  const hasPending = pendingCount > 0;
  const hasChanges = pendingCount + approvedCount + implementedCount > 0;

  if (hasPending) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between gap-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-800">
            {pendingCount} recommendation{pendingCount !== 1 ? "s" : ""} ready for review
          </span>
        </div>
        <Link
          href={`/portal/${token}/approvals`}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] transition-all duration-150"
        >
          Review →
        </Link>
      </div>
    );
  }

  if (hasChanges) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="text-sm text-slate-600">
          Everything is on track.{" "}
          {implementedCount > 0 && (
            <span className="text-slate-400">
              {implementedCount} change{implementedCount !== 1 ? "s" : ""} implemented.
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
      <span className="text-sm text-slate-500">Your site audit is underway — recommendations coming soon.</span>
    </div>
  );
}
