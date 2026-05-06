"use client";

import Link from "next/link";

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

interface DashboardHeroProps {
  pendingCount: number;
  approvedCount: number;
  implementedCount: number;
  pendingTitleCount: number;
  auditIssueCount: number;
  auditStatus: string | null;
  token: string;
  contactName: string;
  status: string;
}

const CARD_CLASS =
  "bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] px-5 py-3.5 flex items-center justify-between";
const CARD_CLASS_LEFT =
  "bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] px-5 py-3.5 flex items-center gap-2.5";

export function DashboardHero({
  pendingCount,
  approvedCount,
  implementedCount,
  pendingTitleCount,
  auditIssueCount,
  auditStatus,
  token,
}: DashboardHeroProps) {
  const auditComplete = auditStatus === "complete";
  const auditInFlight = auditStatus !== null && !auditComplete;
  const hasChanges = pendingCount + approvedCount + implementedCount > 0;

  // 1. Audit still running → "underway"
  if (auditInFlight) {
    return (
      <div className={CARD_CLASS_LEFT}>
        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
        <span className="text-[13px] text-slate-500">Your site audit is underway — recommendations coming soon.</span>
      </div>
    );
  }

  // 2. Pending Changes → highest-priority CTA
  if (pendingCount > 0) {
    return (
      <div className={CARD_CLASS}>
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

  // 3. Pending titles to approve → secondary CTA
  if (pendingTitleCount > 0) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-[13px] font-medium text-slate-900">
            <span className="tabular">{pendingTitleCount}</span> article title{pendingTitleCount !== 1 ? "s" : ""} ready for review
          </span>
        </div>
        <Link
          href={`/portal/${token}/content`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]"
        >
          Review
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // 4. Audit complete with issues but no actionable Changes yet
  if (auditComplete && auditIssueCount > 0 && !hasChanges) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          <span className="text-[13px] font-medium text-slate-900">
            Audit complete — <span className="tabular">{auditIssueCount}</span> issue{auditIssueCount !== 1 ? "s" : ""} found
          </span>
        </div>
        <Link
          href={`/portal/${token}/audit`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]"
        >
          View
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // 5. Has approved/implemented changes → "on track"
  if (hasChanges) {
    return (
      <div className={CARD_CLASS_LEFT}>
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

  // 6. Default — no audit yet, or fresh signup; show "underway"
  return (
    <div className={CARD_CLASS_LEFT}>
      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
      <span className="text-[13px] text-slate-500">Your site audit is underway — recommendations coming soon.</span>
    </div>
  );
}
