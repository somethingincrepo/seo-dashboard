"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getListItemTitle, CATEGORY_EXPLANATIONS } from "@/lib/portal-labels";
import { updateApproval } from "@/lib/changes";
import type { Change } from "@/lib/changes";

const MAX_VISIBLE = 3;

interface PipelineBoardProps {
  changes: Change[];
  token: string;
}

interface Column {
  key: string;
  label: string;
  color: string;
  dotColor: string;
  borderColor: string;
  items: Change[];
}

export function PipelineBoard({ changes, token }: PipelineBoardProps) {
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filteredChanges = changes.filter((c) => !removedIds.has(c.id));

  const getApproval = (c: Change) => c.fields.approval || c.fields.approval_status;
  const isComplete = (c: Change) =>
    c.fields.execution_status === "complete" || !!c.fields.implemented_at;

  const columns: Column[] = [
    {
      key: "pending",
      label: "Pending Review",
      color: "text-amber-400",
      dotColor: "bg-amber-400",
      borderColor: "border-t-amber-500",
      items: filteredChanges.filter((c) => getApproval(c) === "pending"),
    },
    {
      key: "approved",
      label: "Approved",
      color: "text-emerald-400",
      dotColor: "bg-emerald-400",
      borderColor: "border-t-emerald-500",
      items: filteredChanges.filter(
        (c) =>
          getApproval(c) === "approved" &&
          !isComplete(c) &&
          c.fields.execution_status !== "implementing"
      ),
    },
    {
      key: "implementing",
      label: "In Progress",
      color: "text-blue-400",
      dotColor: "bg-blue-400",
      borderColor: "border-t-blue-500",
      items: filteredChanges.filter(
        (c) => c.fields.execution_status === "implementing" && !isComplete(c)
      ),
    },
    {
      key: "complete",
      label: "Complete",
      color: "text-violet-400",
      dotColor: "bg-violet-400",
      borderColor: "border-t-violet-500",
      items: filteredChanges.filter((c) => isComplete(c)),
    },
  ];

  const tier1Pending = columns[0].items.filter(
    (c) => c.fields.implementation_tier === "tier_1"
  );

  const applyDecision = useCallback(async (change: Change, decision: "approved" | "skipped" | "question", notes?: string) => {
    setSubmitting(true);
    try {
      await updateApproval(change.id, decision, notes);
      if (decision === "approved") {
        setFeedback("Got it — we'll implement this within 24 hours.");
      } else if (decision === "skipped") {
        setFeedback("No problem. You can always revisit this later.");
      } else {
        setFeedback("Question submitted. We'll respond within 1 business day.");
      }
      setTimeout(() => {
        setRemovedIds((prev) => new Set(prev).add(change.id));
        setSelectedChange(null);
        setFeedback(null);
        setShowQuestion(false);
        setQuestionText("");
        setShowTechnical(false);
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  }, []);

  function extractPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url || "/";
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  const handleCardClick = (change: Change) => {
    setSelectedChange(change);
    setFeedback(null);
    setShowQuestion(false);
    setQuestionText("");
    setShowTechnical(false);
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => {
          const visible = col.items.slice(0, MAX_VISIBLE);
          const overflow = col.items.length - MAX_VISIBLE;

          return (
            <div key={col.key} className={`bg-white/[0.03] rounded-2xl p-4 flex flex-col border-t-2 ${col.borderColor} min-h-[320px]`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  {col.label}
                </span>
                <span className={`text-xs font-bold ${col.color}`}>
                  {col.items.length}
                </span>
              </div>

              {col.items.length === 0 ? (
                <div className="text-xs text-white/20 py-8 text-center flex-1">
                  Nothing here yet
                </div>
              ) : (
                <div className="space-y-2 flex-1">
                  {visible.map((change) => {
                    const changeType = change.fields.type || change.fields.change_type;
                    const cat = change.fields.cat || change.fields.category || "";
                    const path = extractPath(change.fields.page_url);
                    const isSelected = selectedChange?.id === change.id;

                    return (
                      <div
                        key={change.id}
                        onClick={() => handleCardClick(change)}
                        className={`bg-white/[0.05] hover:bg-white/[0.08] rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${isSelected ? "ring-1 ring-violet-400/40 bg-white/[0.08]" : ""}`}
                        title={
                          col.key === "approved" && change.fields.approved_at
                            ? `Approved on ${formatDate(change.fields.approved_at)}`
                            : undefined
                        }
                      >
                        <div className="text-xs font-medium text-white/70 group-hover:text-white/90 truncate">
                          {getListItemTitle(changeType, change.fields.page_url, 28)}
                        </div>
                        <div className="text-[11px] text-white/25 mt-0.5 truncate">
                          {path}
                        </div>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <Link
                      href={col.key === "pending" ? `/portal/${token}/approvals` : `/portal/${token}/activity`}
                      className="block text-xs text-white/20 hover:text-white/40 px-3 py-1 mt-2 transition-colors duration-150"
                    >
                      +{overflow} more
                    </Link>
                  )}
                </div>
              )}

              {col.key === "pending" && col.items.length > 0 && (
                <div className="mt-auto pt-3 border-t border-white/[0.06] space-y-2">
                  {tier1Pending.length > 0 && (
                    <Link
                      href={`/portal/${token}/approvals`}
                      className="block text-xs py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/15 text-emerald-300/70 hover:bg-emerald-500/25 hover:text-emerald-300 transition-all duration-150 w-full text-center"
                    >
                      Approve {tier1Pending.length} Quick Win{tier1Pending.length !== 1 ? "s" : ""}
                    </Link>
                  )}
                  <Link
                    href={`/portal/${token}/approvals`}
                    className="block text-xs text-violet-400/70 hover:text-violet-400 transition-colors duration-150"
                  >
                    Review All →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Drawer Overlay ── */}
      {selectedChange && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setSelectedChange(null);
            setFeedback(null);
            setShowQuestion(false);
            setQuestionText("");
            setShowTechnical(false);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Drawer panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-96 bg-[#0a0a14]/95 backdrop-blur-xl border-l border-white/[0.06] flex flex-col animate-slide-in-right"
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
                  setFeedback(null);
                  setShowQuestion(false);
                  setQuestionText("");
                  setShowTechnical(false);
                }}
                className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none ml-3 mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Link to approvals */}
            <div className="px-6 pt-3">
              <Link
                href={`/portal/${token}/approvals?selected=${selectedChange.id}`}
                className="text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors"
              >
                View in Approvals →
              </Link>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 pb-28">
              {/* Title */}
              <h2 className="text-lg font-semibold text-white/90 mb-1 mt-3">
                {getListItemTitle(
                  selectedChange.fields.type || selectedChange.fields.change_type,
                  selectedChange.fields.page_url
                )}
              </h2>
              <a
                href={selectedChange.fields.page_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-400/60 hover:text-violet-400 transition-colors block truncate mb-6"
              >
                {selectedChange.fields.page_url}
              </a>

              <div className="space-y-6">
                {/* What We Recommend */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
                    What We Recommend
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {selectedChange.fields.proposed_value || "We'll make an optimization to improve this page's search visibility."}
                  </p>
                </div>

                {/* Why It Matters */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
                    Why It Matters
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed italic">
                    {selectedChange.fields.reasoning ||
                      CATEGORY_EXPLANATIONS[selectedChange.fields.cat || selectedChange.fields.category || ""] ||
                      "This change helps improve your site's search visibility."}
                  </p>
                </div>

                {/* Technical Details — collapsible */}
                {(selectedChange.fields.current_value || selectedChange.fields.proposed_value) && (
                  <div>
                    <button
                      onClick={() => setShowTechnical(!showTechnical)}
                      className="flex items-center gap-2 text-xs text-white/20 hover:text-white/40 transition-colors duration-150"
                    >
                      <span className={`transition-transform duration-150 ${showTechnical ? "rotate-90" : ""}`}>▶</span>
                      Technical Details
                    </button>
                    {showTechnical && (
                      <div className="mt-3 space-y-3">
                        {selectedChange.fields.current_value && (
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Current</div>
                            <pre className="text-xs font-mono text-white/60 bg-red-500/5 border border-red-400/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                              {selectedChange.fields.current_value}
                            </pre>
                          </div>
                        )}
                        {selectedChange.fields.proposed_value && (
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Proposed</div>
                            <pre className="text-xs font-mono text-emerald-300/70 bg-emerald-500/5 border border-emerald-400/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                              {selectedChange.fields.proposed_value}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Question textarea */}
              {showQuestion && (
                <div className="mt-6">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2 block">
                    What would you like to know?
                  </label>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Ask us anything about this recommendation..."
                    className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40 resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setShowQuestion(false); setQuestionText(""); }}
                      className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors duration-150"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (questionText.trim()) {
                          applyDecision(selectedChange, "question", questionText.trim());
                        }
                      }}
                      disabled={!questionText.trim() || submitting}
                      className="px-4 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-xs text-blue-300 hover:bg-blue-500/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit question
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky action bar */}
            <div className="absolute bottom-0 left-0 right-0 pt-4 pb-4 px-6 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14]/95 to-transparent">
              {feedback ? (
                <div className="text-sm text-emerald-300 py-2 text-center">
                  {feedback}
                </div>
              ) : selectedChange.fields.approval !== "pending" ? (
                <div className="text-sm text-white/40 py-2">
                  {selectedChange.fields.approval === "approved"
                    ? `You approved this on ${formatDate(selectedChange.fields.approved_at)}.`
                    : selectedChange.fields.approval === "skipped"
                    ? "You skipped this."
                    : selectedChange.fields.approval === "question"
                    ? "Question pending."
                    : null}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyDecision(selectedChange, "approved")}
                    disabled={submitting}
                    className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-emerald-500/20 border border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/30 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => applyDecision(selectedChange, "skipped")}
                    disabled={submitting}
                    className="flex-[2] py-3 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] hover:text-white/60 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    — Skip
                  </button>
                  <button
                    onClick={() => setShowQuestion(true)}
                    disabled={submitting}
                    className="w-12 py-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-400/20 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ?
                  </button>
                </div>
              )}
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
