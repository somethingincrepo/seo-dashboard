"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-[13px] font-medium text-slate-900">
            <span className="tabular">{pendingCount}</span> recommendation{pendingCount !== 1 ? "s" : ""} ready for review
          </span>
        </div>
        <Link
          href={`/portal/${token}/approvals`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]"
        >
          Review
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  if (hasChanges) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] px-5 py-3.5 flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[13px] text-slate-700">
          Everything is on track.{" "}
          {implementedCount > 0 && (
            <span className="text-slate-500">
              <span className="tabular">{implementedCount}</span> change{implementedCount !== 1 ? "s" : ""} implemented.
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] px-5 py-3.5 flex items-center gap-2.5">
      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
      <span className="text-[13px] text-slate-500">Your site audit is underway — recommendations coming soon.</span>
    </div>
  );
}
