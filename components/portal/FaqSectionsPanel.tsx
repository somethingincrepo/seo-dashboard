"use client";

import React, { useState, useCallback } from "react";
import type { FaqSection } from "@/lib/supabase";
import type { PackageTier } from "@/lib/packages";

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-rose-50 text-rose-700 ring-rose-200/60",
  High: "bg-amber-50 text-amber-700 ring-amber-200/60",
  Medium: "bg-blue-50 text-blue-700 ring-blue-200/60",
  Low: "bg-slate-100 text-slate-600 ring-slate-200/60",
};

function PriorityPill({ priority }: { priority: string | null }) {
  const p = priority ?? "Low";
  const cls = PRIORITY_COLORS[p] ?? PRIORITY_COLORS.Low;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset ${cls}`}>
      {p}
    </span>
  );
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function hostPath(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

type FaqCardProps = {
  section: FaqSection;
  onApprove: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  readonly?: boolean;
};

function FaqCard({ section, onApprove, onSkip, readonly }: FaqCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"approve" | "skip" | null>(null);
  const [localStatus, setLocalStatus] = useState(section.status);
  const [localApproval, setLocalApproval] = useState(section.portal_approval);

  const isApproved = localApproval === "approved" || localStatus === "approved";
  const isSkipped = localApproval === "skipped" || localStatus === "skipped";

  const handleApprove = useCallback(async () => {
    if (loading || isApproved || readonly) return;
    setLoading("approve");
    try {
      await onApprove(section.id);
      setLocalStatus("approved");
      setLocalApproval("approved");
    } finally {
      setLoading(null);
    }
  }, [loading, isApproved, readonly, onApprove, section.id]);

  const handleSkip = useCallback(async () => {
    if (loading || isSkipped || readonly) return;
    setLoading("skip");
    try {
      await onSkip(section.id);
      setLocalStatus("skipped");
      setLocalApproval("skipped");
    } finally {
      setLoading(null);
    }
  }, [loading, isSkipped, readonly, onSkip, section.id]);

  const questions = section.generated_questions ?? [];

  return (
    <div className={`rounded-xl border transition-all ${
      isApproved
        ? "border-teal-200 bg-teal-50/40"
        : isSkipped
        ? "border-slate-200 bg-slate-50/60 opacity-60"
        : "border-slate-200 bg-white hover:border-slate-300"
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityPill priority={section.priority} />
              {section.existing_faq_count > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200/60">
                  {section.existing_faq_count} existing FAQ{section.existing_faq_count !== 1 ? "s" : ""}
                </span>
              )}
              {isApproved && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200/60">
                  Approved
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-slate-900 leading-snug truncate">
              {section.page_title || hostPath(section.page_url)}
            </p>
            <a
              href={section.page_url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors truncate block"
            >
              {hostPath(section.page_url)}
            </a>
          </div>
          <div className="text-[11px] text-slate-400 shrink-0">{fmt(section.proposed_at)}</div>
        </div>

        {/* Q&A preview */}
        <div className="mt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {questions.length} question{questions.length !== 1 ? "s" : ""} generated
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              {questions.map((qa, i) => (
                <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[12px] font-semibold text-slate-800 leading-snug">{qa.q}</p>
                  <p className="mt-1 text-[12px] text-slate-600 leading-relaxed">{qa.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!readonly && !isSkipped && (
          <div className="mt-3 flex items-center gap-2">
            {!isApproved ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={!!loading}
                  className="px-3 py-1.5 rounded-md text-[12px] font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 transition-colors"
                >
                  {loading === "approve" ? "Approving…" : "Approve"}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={!!loading}
                  className="px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                >
                  {loading === "skip" ? "Skipping…" : "Skip"}
                </button>
              </>
            ) : (
              <button
                onClick={handleSkip}
                disabled={!!loading}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                Undo approval
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  items: FaqSection[];
  historicalItems: FaqSection[];
  token: string;
  limit: number;
  clientPackage: PackageTier;
};

export function FaqSectionsPanel({ items, historicalItems, token, limit }: Props) {
  const [sections, setSections] = useState<FaqSection[]>(items);
  const [historical] = useState<FaqSection[]>(historicalItems);

  const approvedCount = sections.filter(
    (s) => s.portal_approval === "approved" || s.status === "approved"
  ).length;

  const handleApprove = useCallback(async (id: string) => {
    await fetch(`/api/portal/faqs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve" }),
    });
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "approved", portal_approval: "approved" } : s
      )
    );
  }, []);

  const handleSkip = useCallback(async (id: string) => {
    await fetch(`/api/portal/faqs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "skip" }),
    });
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "skipped", portal_approval: "skipped" } : s
      )
    );
  }, []);

  const visibleSections = sections.filter((s) => s.status !== "skipped" && s.portal_approval !== "skipped");

  return (
    <div className="h-full flex flex-col gap-5 overflow-y-auto">
      {/* Quota bar */}
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-slate-700">This month&apos;s FAQ sections</span>
          <span className="text-[12px] text-slate-500 tabular-nums">
            {approvedCount} / {limit} approved
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${Math.min(100, (approvedCount / Math.max(limit, 1)) * 100)}%` }}
          />
        </div>
        {limit > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            {limit - approvedCount > 0
              ? `${limit - approvedCount} slot${limit - approvedCount !== 1 ? "s" : ""} remaining this month`
              : "All slots used for this month"}
          </p>
        )}
      </div>

      {/* Current month */}
      {visibleSections.length === 0 ? (
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-slate-700">No FAQ sections yet</p>
          <p className="mt-1 text-[12px] text-slate-400">
            FAQ sections are generated after your audit completes and each month thereafter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSections.map((s) => (
            <FaqCard
              key={s.id}
              section={s}
              onApprove={handleApprove}
              onSkip={handleSkip}
            />
          ))}
        </div>
      )}

      {/* Historical */}
      {historical.length > 0 && (
        <div className="shrink-0 mt-2">
          <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Previous months
          </h2>
          <div className="space-y-3">
            {historical.map((s) => (
              <FaqCard
                key={s.id}
                section={s}
                onApprove={handleApprove}
                onSkip={handleSkip}
                readonly
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
