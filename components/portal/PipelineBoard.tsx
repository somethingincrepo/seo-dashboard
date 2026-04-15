"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getListItemTitle, getWhatWeRecommend, getWhyItMatters, getTechnicalCurrent, getTechnicalProposed, hasTechnicalDetails, getDocUrl } from "@/lib/portal-labels";
import { useApprovalActions } from "./useApprovalActions";
import { ApprovalActionBar } from "./ApprovalActionBar";
import { BeforeAfterPanel } from "./BeforeAfterPanel";
import type { Change } from "@/lib/changes";

interface PipelineBoardProps {
  changes: Change[];
  token: string;
}

interface Column {
  key: string;
  label: string;
  countColor: string;
  gradientStyle: string;
  items: Change[];
}

export function PipelineBoard({ changes, token }: PipelineBoardProps) {
  const router = useRouter();
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);

  const onDecisionApplied = useCallback((changeId: string) => {
    setTimeout(() => {
      setRemovedIds((prev) => new Set(prev).add(changeId));
      setSelectedChange(null);
      setShowQuestion(false);
      setQuestionText("");
      setShowTechnical(false);
      router.refresh();
    }, 1500);
  }, [router]);

  const onUndoApplied = useCallback(() => {
    setTimeout(() => setSelectedChange(null), 2000);
  }, []);

  const {
    submitting,
    feedback,
    error,
    confirmApprove,
    setConfirmApprove,
    undoTarget,
    handleUndo,
    applyDecision,
    clearFeedback,
  } = useApprovalActions({ token, onDecisionApplied, onUndoApplied });

  const filteredChanges = changes.filter((c) => !removedIds.has(c.id));

  const getApproval = (c: Change) => c.fields.approval || c.fields.approval_status;
  const isComplete = (c: Change) =>
    c.fields.execution_status === "complete" || !!c.fields.implemented_at;

  const columns: Column[] = [
    {
      key: "pending",
      label: "To Review",
      countColor: "text-amber-600",
      gradientStyle: "linear-gradient(90deg, #F59E0B, #FCD34D)",
      items: filteredChanges.filter((c) => getApproval(c) === "pending"),
    },
    {
      key: "approved",
      label: "Approved",
      countColor: "text-emerald-600",
      gradientStyle: "linear-gradient(90deg, #10B981, #34D399)",
      items: filteredChanges.filter(
        (c) =>
          getApproval(c) === "approved" &&
          !isComplete(c)
      ),
    },
    {
      key: "complete",
      label: "Implemented",
      countColor: "text-indigo-600",
      gradientStyle: "linear-gradient(90deg, #4F46E5, #818CF8)",
      items: filteredChanges.filter((c) => isComplete(c)),
    },
  ];

  function extractPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url || "/";
    }
  }

  const handleCardClick = (change: Change) => {
    setSelectedChange(change);
    clearFeedback();
    setShowQuestion(false);
    setQuestionText("");
    setShowTechnical(false);
  };

  const priorityDot = (priority: string) => {
    if (priority === "Critical") return "bg-red-500";
    if (priority === "High") return "bg-orange-500";
    if (priority === "Medium") return "bg-amber-400";
    if (priority === "Low") return "bg-emerald-500";
    return "bg-slate-400";
  };

  return (
    <div className="relative h-full">
      <div className="grid grid-cols-3 gap-4 h-full">
        {columns.map((col) => (
          <div key={col.key} className="bg-white/60 backdrop-blur-sm rounded-2xl flex flex-col border border-slate-200/60 h-full overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            {/* Gradient top stripe */}
            <div className="h-[3px] flex-shrink-0 rounded-t-2xl" style={{ background: col.gradientStyle }} />

            {/* Column header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-3 flex-shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {col.label}
              </span>
              <span className={`text-xs font-bold tabular ${col.countColor}`}>
                {col.items.length}
              </span>
            </div>

            {/* Scrollable card list */}
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-y-auto px-3 pb-3">
              {col.items.length === 0 ? (
                <div className="text-xs text-slate-300 py-10 text-center">
                  Nothing here yet
                </div>
              ) : (
                <div className="space-y-2">
                  {col.items.map((change) => {
                    const changeType = change.fields.type || change.fields.change_type;
                    const cat = change.fields.cat || change.fields.category || "";
                    const path = extractPath(change.fields.page_url);
                    const isSelected = selectedChange?.id === change.id;

                    return (
                      <div
                        key={change.id}
                        onClick={() => handleCardClick(change)}
                        className={`group rounded-xl p-3.5 cursor-pointer transition-all duration-200 border ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-300"
                            : "bg-white border-slate-200 hover:-translate-y-0.5"
                        }`}
                        style={isSelected
                          ? { boxShadow: "var(--shadow-sm)" }
                          : { boxShadow: "var(--shadow-xs)" }
                        }
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-xs)";
                        }}
                      >
                        {/* Title row */}
                        <div className="flex items-start gap-2.5 mb-2">
                          {change.fields.priority && (
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${priorityDot(change.fields.priority)}`} />
                          )}
                          <div className="text-xs font-medium text-slate-800 group-hover:text-slate-900 leading-snug line-clamp-2 transition-colors duration-150 flex-1">
                            {getListItemTitle(changeType, change.fields.page_url, 40, change.fields.change_title, false, change.fields)}
                          </div>
                        </div>

                        {/* URL path */}
                        <div className="text-[11px] text-slate-400 font-mono truncate mb-2.5 pl-4">
                          {path}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap pl-4">
                          {cat && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                              {cat}
                            </span>
                          )}
                          {change.fields.implementation_tier === "tier_1" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                              Auto
                            </span>
                          )}
                          {col.key === "approved" && change.fields.approved_at && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(change.fields.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          {col.key === "complete" && change.fields.implemented_at && (
                            <span className="text-[10px] text-emerald-600">
                              ✓ {new Date(change.fields.implemented_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
              {col.items.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-50/90 to-transparent pointer-events-none rounded-b-2xl" />
              )}
            </div>

            {/* Footer CTA */}
            {col.key === "pending" && col.items.length > 0 && (
              <div className="flex-shrink-0 px-4 pb-3 pt-2 border-t border-slate-200/60">
                <Link
                  href={`/portal/${token}/approvals`}
                  className="block text-xs text-indigo-500 hover:text-indigo-700 transition-colors duration-150"
                >
                  Review All →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Drawer Overlay ── */}
      {selectedChange && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setSelectedChange(null);
            clearFeedback();
            setShowQuestion(false);
            setQuestionText("");
            setShowTechnical(false);
            setConfirmApprove(false);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          {/* Drawer panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col animate-slide-in-right"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge value={selectedChange.fields.cat || selectedChange.fields.category || "Other"} variant="category" />
                {selectedChange.fields.type && (
                  <StatusBadge value={selectedChange.fields.type} variant="category" />
                )}
                {selectedChange.fields.confidence && (
                  <StatusBadge value={selectedChange.fields.confidence} variant="confidence" />
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedChange(null);
                  clearFeedback();
                  setShowQuestion(false);
                  setQuestionText("");
                  setShowTechnical(false);
                  setConfirmApprove(false);
                }}
                className="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none ml-3 mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Link to approvals */}
            <div className="px-6 pt-3">
              <Link
                href={`/portal/${token}/approvals?selected=${selectedChange.id}`}
                className="text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                View in Approvals →
              </Link>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 pb-28">
              {/* Title */}
              <h2 className="text-lg font-semibold text-slate-900 mb-1 mt-3">
                {getListItemTitle(
                  selectedChange.fields.type || selectedChange.fields.change_type,
                  selectedChange.fields.page_url,
                  undefined,
                  undefined,
                  false,
                  selectedChange.fields
                )}
              </h2>
              <a
                href={selectedChange.fields.page_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors block truncate mb-6"
              >
                {selectedChange.fields.page_url}
              </a>

              <div className="space-y-6">
                {/* What We Recommend */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                    What We Recommend
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {getWhatWeRecommend(selectedChange.fields)}
                  </p>
                </div>

                {/* View the Draft */}
                {getDocUrl(selectedChange.fields) && (
                  <div>
                    <a
                      href={getDocUrl(selectedChange.fields)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 transition-colors duration-150 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"
                    >
                      View the Draft ↗
                    </a>
                  </div>
                )}

                {/* Why It Matters */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                    Why It Matters
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed italic">
                    {getWhyItMatters(selectedChange.fields)}
                  </p>
                </div>

                {/* Before/After — shown only for implemented changes */}
                {isComplete(selectedChange) && (
                  <BeforeAfterPanel change={selectedChange} />
                )}

                {/* Technical Details — collapsible */}
                {hasTechnicalDetails(selectedChange.fields, getWhatWeRecommend(selectedChange.fields)) && (
                  <div>
                    <button
                      onClick={() => setShowTechnical(!showTechnical)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors duration-150"
                    >
                      <span className={`transition-transform duration-150 ${showTechnical ? "rotate-90" : ""}`}>▶</span>
                      Technical Details
                    </button>
                    {showTechnical && (() => {
                      const techCurrent = getTechnicalCurrent(selectedChange.fields);
                      const techProposed = getTechnicalProposed(selectedChange.fields, getWhatWeRecommend(selectedChange.fields));
                      return (
                        <div className="mt-3 space-y-3">
                          {techCurrent && (
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Current</div>
                              <pre className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                                {techCurrent}
                              </pre>
                            </div>
                          )}
                          {techProposed && (
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Proposed</div>
                              <pre className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                                {techProposed}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Question textarea */}
              {showQuestion && (
                <div className="mt-6">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                    What would you like to know?
                  </label>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Ask us anything about this recommendation..."
                    className="w-full h-24 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setShowQuestion(false); setQuestionText(""); }}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors duration-150"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (questionText.trim()) {
                          applyDecision(selectedChange.id, "question", questionText.trim());
                        }
                      }}
                      disabled={!questionText.trim() || submitting}
                      className="px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 hover:bg-blue-100 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit question
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky action bar */}
            <div className="absolute bottom-0 left-0 right-0 pt-4 pb-4 px-6 bg-gradient-to-t from-white via-white/95 to-transparent">
              <ApprovalActionBar
                changeId={selectedChange.id}
                approval={selectedChange.fields.approval}
                approvedAt={selectedChange.fields.approved_at}
                implementedAt={selectedChange.fields.implemented_at}
                submitting={submitting}
                feedback={feedback}
                error={error}
                confirmApprove={confirmApprove}
                undoTarget={undoTarget}
                isLocalDecision={false}
                onApprove={() => setConfirmApprove(true)}
                onSkip={() => applyDecision(selectedChange.id, "skipped")}
                onQuestion={() => setShowQuestion(true)}
                onConfirmApprove={() => applyDecision(selectedChange.id, "approved")}
                onCancelConfirm={() => setConfirmApprove(false)}
                onUndo={handleUndo}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
