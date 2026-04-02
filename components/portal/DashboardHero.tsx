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
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-sm font-medium text-white/80">
            {pendingCount} recommendation{pendingCount !== 1 ? "s" : ""} ready for review
          </span>
        </div>
        <Link
          href={`/portal/${token}/approvals`}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium bg-violet-500/20 border border-violet-400/30 text-violet-300 hover:bg-violet-500/30 transition-all"
        >
          Review →
        </Link>
      </div>
    );
  }

  if (hasChanges) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-6 py-4 flex items-center gap-4">
        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <span className="text-sm text-white/60">
          Everything is on track.{" "}
          {implementedCount > 0 && (
            <span className="text-white/40">
              {implementedCount} change{implementedCount !== 1 ? "s" : ""} implemented.
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-6 py-4 flex items-center gap-4">
      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
      <span className="text-sm text-white/60">Your site audit is underway — recommendations coming soon.</span>
    </div>
  );
}
