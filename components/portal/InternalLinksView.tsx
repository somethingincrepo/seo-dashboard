import { ApprovalMasterDetail } from "@/components/portal/ApprovalMasterDetail";
import { PACKAGE_LABELS } from "@/lib/packages";
import type { PackageTier } from "@/lib/packages";
import type { Change } from "@/lib/changes";

interface InternalLinksViewProps {
  pending: Change[];
  decided: Change[];
  pkg: PackageTier;
  monthlyTarget: number;
  implementedCount: number;
  token: string;
  contactEmail: string;
}

export function InternalLinksView({
  pending,
  decided,
  pkg,
  monthlyTarget,
  implementedCount,
  token,
  contactEmail,
}: InternalLinksViewProps) {
  const pct =
    monthlyTarget === 0
      ? 100
      : Math.min(100, Math.round((implementedCount / monthlyTarget) * 100));
  const done = implementedCount >= monthlyTarget;
  const pendingCount = pending.length;
  const isEmpty = pending.length === 0 && decided.length === 0;

  const pkgBadge: Record<PackageTier, string> = {
    starter: "bg-slate-100 text-slate-600",
    growth: "bg-indigo-50 text-indigo-700",
    authority: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Internal Links
        </h1>
        <p className="text-base text-slate-500 mt-1">
          Build topical authority by connecting related pages across your site —
          based on your keyword research.
        </p>
      </div>

      {/* Quota card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-800">
              This Month
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Internal links implemented toward your monthly plan
            </p>
          </div>
          <span
            className={`text-[11px] font-semibold px-2 py-1 rounded-full ${pkgBadge[pkg]}`}
          >
            {PACKAGE_LABELS[pkg]}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  done ? "bg-emerald-500" : "bg-indigo-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={`text-[13px] font-semibold tabular-nums shrink-0 ${
                done ? "text-emerald-600" : "text-slate-700"
              }`}
            >
              {implementedCount} / {monthlyTarget}
            </span>
          </div>

          {/* Status line */}
          <div className="flex items-center gap-3 flex-wrap">
            {done && pendingCount === 0 ? (
              <span className="text-[12px] text-emerald-600 font-medium">
                All {monthlyTarget} links complete for this month
              </span>
            ) : (
              <>
                {implementedCount > 0 && (
                  <span className="text-[12px] text-slate-500">
                    {implementedCount} implemented
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60">
                    {pendingCount} pending approval
                  </span>
                )}
                {pendingCount === 0 && implementedCount < monthlyTarget && (
                  <span className="text-[12px] text-slate-400 italic">
                    New recommendations will appear based on your keyword research
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Explainer */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-[11px] text-slate-400 mb-1">Your plan</div>
            <div className="text-[18px] font-bold text-slate-900">
              {monthlyTarget}
            </div>
            <div className="text-[10px] text-slate-400">links / month</div>
          </div>
          <div className="text-center border-x border-slate-100">
            <div className="text-[11px] text-slate-400 mb-1">Implemented</div>
            <div
              className={`text-[18px] font-bold ${
                done ? "text-emerald-600" : "text-slate-900"
              }`}
            >
              {implementedCount}
            </div>
            <div className="text-[10px] text-slate-400">this month</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-slate-400 mb-1">Awaiting</div>
            <div
              className={`text-[18px] font-bold ${
                pendingCount > 0 ? "text-amber-600" : "text-slate-300"
              }`}
            >
              {pendingCount}
            </div>
            <div className="text-[10px] text-slate-400">your approval</div>
          </div>
        </div>
      </div>

      {/* Content area */}
      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-5 h-5 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800 mb-2">
            No link recommendations yet
          </h3>
          <p className="text-[13px] text-slate-400 max-w-sm mx-auto leading-relaxed">
            We scan your site monthly and generate internal link recommendations
            based on your keyword research. Check back after your next scheduled
            analysis.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">
              Link Recommendations
            </h2>
            <p className="text-[13px] text-slate-400 mt-0.5">
              Each recommendation connects two related pages using descriptive
              anchor text — improving how Google understands your site&apos;s
              topic structure.
            </p>
          </div>
          <ApprovalMasterDetail
            changes={pending}
            decidedChanges={decided}
            token={token}
            contactEmail={contactEmail}
          />
        </div>
      )}
    </div>
  );
}
