import type { AuditRunSummary } from "@/lib/audit/queries";

interface Props {
  state: "never_run" | "in_progress" | "failed";
  run?: AuditRunSummary;
}

export function AuditEmptyState({ state, run }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Site Audit</h1>
        <p className="text-base text-slate-500 mt-1">
          A deterministic, repeatable audit of your site's technical, on-page, content, and AI-readability signals.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-10 text-center">
        {state === "never_run" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p className="text-slate-700 font-medium">Your audit hasn't started yet</p>
            <p className="text-slate-500 text-sm mt-1.5 max-w-md mx-auto">
              Audits run automatically after you submit your intake form. If you've just signed up, this should populate within a few minutes.
            </p>
          </>
        )}
        {state === "in_progress" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <p className="text-slate-700 font-medium">Audit in progress</p>
            <p className="text-slate-500 text-sm mt-1.5 max-w-md mx-auto">
              We're currently crawling your site
              {run?.pages_crawled ? ` (${run.pages_crawled.toLocaleString()} pages so far)` : ""}.
              Most audits finish within 5–15 minutes. This page will update automatically when results are ready.
            </p>
          </>
        )}
        {state === "failed" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-slate-700 font-medium">Audit didn't complete</p>
            <p className="text-slate-500 text-sm mt-1.5 max-w-md mx-auto">
              We hit an error while running this audit. Your account manager has been notified — they'll re-run it for you.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
