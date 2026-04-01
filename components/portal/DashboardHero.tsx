"use client";

import Link from "next/link";
import type { Report } from "@/lib/reports";

interface DashboardHeroProps {
  pendingCount: number;
  approvedCount: number;
  implementedCount: number;
  token: string;
  contactName: string;
  status: string;
  reports: Report[];
}

export function DashboardHero({
  pendingCount,
  approvedCount,
  implementedCount,
  token,
  contactName,
  status,
  reports,
}: DashboardHeroProps) {
  const hasPending = pendingCount > 0;
  const hasChanges = pendingCount + approvedCount + implementedCount > 0;
  const latestReport = reports[0];

  if (hasPending) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-white/90">
          You have {pendingCount} recommendations to review
        </h2>
        <p className="text-sm text-white/50 leading-relaxed mt-2 max-w-xl">
          We've completed your site audit and found {pendingCount + approvedCount + implementedCount} opportunities
          to improve your search visibility.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <Link
            href={`/portal/${token}/approvals`}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-violet-500/20 border border-violet-400/30 text-violet-300 hover:bg-violet-500/30 transition-all"
          >
            Review Recommendations →
          </Link>
        </div>
        {latestReport && (
          <p className="text-xs text-white/25 mt-4">
            Your latest report is available —{" "}
            <Link href={`/portal/${token}/reports`} className="text-violet-400/60 hover:text-violet-400 transition-colors">
              Month {latestReport.fields.month}
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (hasChanges) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-white/90">
          Everything is on track
        </h2>
        <p className="text-sm text-white/50 leading-relaxed mt-2 max-w-xl">
          We're working on your next set of optimizations. You'll be notified when new recommendations are ready for review.
          {implementedCount > 0 && ` ${implementedCount} change${implementedCount !== 1 ? "s" : ""} have been implemented so far.`}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-8">
      <h2 className="text-xl font-semibold text-white/90">
        We're getting started
      </h2>
      <p className="text-sm text-white/50 leading-relaxed mt-2 max-w-xl">
        Your initial site audit is underway. We'll notify you as soon as your first recommendations are ready for review.
      </p>
    </div>
  );
}
