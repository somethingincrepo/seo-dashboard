"use client";

import { useEffect, useState } from "react";
import type { AuditRunSummary } from "@/lib/audit/queries";

interface Props {
  state: "never_run" | "in_progress" | "failed";
  run?: AuditRunSummary;
  token?: string;
}

export function AuditEmptyState({ state, run, token }: Props) {
  const [pagesScanned, setPagesScanned] = useState(run?.pages_crawled ?? 0);
  const [displayCount, setDisplayCount] = useState(run?.pages_crawled ?? 0);

  // Poll for live page count when audit is in progress
  useEffect(() => {
    if (state !== "in_progress" || !token) return;

    const poll = async () => {
      try {
        const r = await fetch(`/api/portal/audit-status?token=${encodeURIComponent(token)}`);
        if (!r.ok) return;
        const data = (await r.json()) as { status: string; pages_crawled: number };
        if (typeof data.pages_crawled === "number") setPagesScanned(data.pages_crawled);
        if (data.status === "complete" || data.status === "failed") {
          window.location.reload();
        }
      } catch {}
    };

    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [state, token]);

  // Smoothly animate the display count toward the real value
  useEffect(() => {
    if (pagesScanned === displayCount) return;
    const diff = pagesScanned - displayCount;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 20));
    const id = setInterval(() => {
      setDisplayCount((n) => {
        const next = n + (diff > 0 ? step : -step);
        if ((diff > 0 && next >= pagesScanned) || (diff < 0 && next <= pagesScanned)) {
          clearInterval(id);
          return pagesScanned;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [pagesScanned]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Site Audit</h1>
        <p className="text-base text-slate-500 mt-1">
          A deterministic, repeatable audit of your site&apos;s technical, on-page, content, and AI-readability signals.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center">
        {state === "never_run" && (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p className="text-slate-700 font-semibold text-lg">Your audit hasn&apos;t started yet</p>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
              Audits run automatically after you submit your intake form. If you&apos;ve just signed up, results will appear here within a few minutes.
            </p>
          </>
        )}

        {state === "in_progress" && (
          <>
            {/* Spinner ring */}
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" style={{ animationDuration: "1s" }} />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-r-indigo-300 animate-spin" style={{ animationDuration: "1.8s", animationDirection: "reverse" }} />
              <div className="absolute inset-4 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
            </div>

            <p className="text-slate-800 font-semibold text-xl">Crawling your site</p>

            {/* Live page count */}
            <div className="mt-5 mb-6 inline-flex flex-col items-center gap-1">
              <span className="text-4xl font-bold tabular-nums text-indigo-600 transition-all duration-300">
                {displayCount.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-indigo-400 tracking-widest uppercase">pages scanned</span>
            </div>

            {/* Indeterminate shimmer bar */}
            <div className="mx-auto max-w-xs h-1.5 rounded-full bg-indigo-100 overflow-hidden mb-6">
              <div
                className="h-full w-1/2 rounded-full bg-indigo-400 opacity-80"
                style={{
                  animation: "auditShimmer 1.6s ease-in-out infinite",
                }}
              />
            </div>

            <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
              Most audits finish in 5–15 minutes. This page updates automatically — no need to refresh.
            </p>
          </>
        )}

        {state === "failed" && (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-slate-700 font-semibold text-lg">Audit didn&apos;t complete</p>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
              We hit an error while running this audit. Your account manager has been notified — they&apos;ll re-run it for you.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes auditShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
