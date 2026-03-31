"use client";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { BatchApproveButton } from "@/components/portal/BatchApproveButton";
import {
  getChangeTitle,
  getListItemTitle,
  CATEGORY_EXPLANATIONS,
} from "@/lib/portal-labels";
import { updateApproval } from "@/lib/changes";
import type { Change } from "@/lib/changes";

const CATEGORY_ORDER = ["Technical", "On-Page", "Content", "AI-GEO"];

interface ApprovalMasterDetailProps {
  changes: Change[];
  decidedChanges: Change[];
  token: string;
  contactEmail: string;
  categoryFilter?: string;
}

interface LocalDecision {
  approval: string;
  client_notes: string;
}

export function ApprovalMasterDetail(props: ApprovalMasterDetailProps) {
  return (
    <Suspense fallback={
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        <div className="w-[40%] flex items-center justify-center text-white/30 text-sm">Loading...</div>
        <div className="w-[60%]" />
      </div>
    }>
      <ApprovalMasterDetailInner {...props} />
    </Suspense>
  );
}

function ApprovalMasterDetailInner({
  changes,
  decidedChanges,
  token,
  contactEmail,
  categoryFilter,
}: ApprovalMasterDetailProps) {
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "decided">("pending");
  const [localChanges, setLocalChanges] = useState<Map<string, LocalDecision>>(new Map());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Deep-link: auto-select change from ?selected= query param
  const initialSelected = searchParams.get("selected");
  useEffect(() => {
    if (initialSelected) {
      setSelectedChangeId(initialSelected);
      // Scroll the selected item into view in the list
      setTimeout(() => {
        const el = document.querySelector(`[data-change-id="${initialSelected}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [initialSelected]);

  const getEffectiveChange = useCallback(
    (change: Change): Change => {
      const local = localChanges.get(change.id);
      if (local) {
        return {
          ...change,
          fields: {
            ...change.fields,
            approval: local.approval || change.fields.approval,
            client_notes: local.client_notes || change.fields.client_notes,
          },
        };
      }
      return change;
    },
    [localChanges]
  );

  const effectivePending = categoryFilter
    ? changes.filter((c) => (c.fields.cat || c.fields.category) === categoryFilter)
    : changes;
  const effectiveDecided = categoryFilter
    ? decidedChanges.filter((c) => (c.fields.cat || c.fields.category) === categoryFilter)
    : decidedChanges;

  const activeChanges = activeTab === "pending" ? effectivePending : effectiveDecided;

  // Group by category
  const grouped: Record<string, Change[]> = {};
  for (const c of activeChanges) {
    const cat = c.fields.cat || c.fields.category || "Other";
    const mapped = getEffectiveChange(c);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(mapped);
  }

  const selectedChange = selectedChangeId
    ? [...effectivePending, ...effectiveDecided].find((c) => c.id === selectedChangeId)
    : null;
  const effectiveSelected = selectedChange ? getEffectiveChange(selectedChange) : null;

  const tier1Ids = effectivePending
    .filter((c) => c.fields.implementation_tier === "tier_1")
    .map((c) => c.id);

  const applyDecision = async (changeId: string, decision: "approved" | "skipped" | "question", notes?: string) => {
    setSubmitting(true);
    try {
      await updateApproval(changeId, decision, notes);
      setLocalChanges((prev) => {
        const next = new Map(prev);
        next.set(changeId, { approval: decision, client_notes: notes || "" });
        return next;
      });

      if (decision === "approved") {
        setFeedback("Got it \u2014 we\u2019ll implement this within 24 hours.");
      } else if (decision === "skipped") {
        setFeedback("No problem. You can always revisit this later.");
      } else {
        setFeedback(`Question submitted. We\u2019ll respond within 1 business day at ${contactEmail}.`);
      }

      setTimeout(() => {
        setFeedback(null);
        setShowQuestion(false);
        setQuestionText("");
        setShowTechnical(false);
        // Auto-advance to next pending
        const currentIdx = effectivePending.findIndex((c) => c.id === changeId);
        const nextPending = effectivePending.find((c, i) => i > currentIdx && !localChanges.has(c.id));
        if (nextPending) {
          setSelectedChangeId(nextPending.id);
        } else {
          const firstPending = effectivePending.find((c) => !localChanges.has(c.id));
          if (firstPending) {
            setSelectedChangeId(firstPending.id);
          } else {
            setSelectedChangeId(null);
          }
        }
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const getApprovalStatus = (change: Change): string => {
    const local = localChanges.get(change.id);
    if (local) return local.approval || change.fields.approval;
    return change.fields.approval || change.fields.approval_status;
  };

  const statusDotColor = (approval: string) => {
    if (approval === "pending") return "bg-amber-400";
    if (approval === "approved") return "bg-emerald-400";
    if (approval === "skipped") return "bg-slate-400";
    if (approval === "question") return "bg-blue-400";
    return "bg-slate-500";
  };

  const truncateUrl = (url: string) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* ── Left Panel ── */}
      <div className="w-[40%] flex flex-col min-w-0 border-r border-white/5 pr-6">
        {/* Tab toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 mb-4">
          {(["pending", "decided"] as const).map((tab) => {
            const count = tab === "pending" ? effectivePending.length : effectiveDecided.length;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedChangeId(null);
                  setFeedback(null);
                  setShowQuestion(false);
                  setShowTechnical(false);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-white/10 text-white/90"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {tab === "pending" ? "Pending" : "Decided"}
                <span className={`ml-1.5 text-xs ${
                  activeTab === tab ? "text-white/50" : "text-white/30"
                }`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Overview bar — pending only */}
        {activeTab === "pending" && effectivePending.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 px-1">
            <span className="text-sm text-white/60">
              <span className="text-white/90 font-semibold">{effectivePending.length}</span> pending
            </span>
            {tier1Ids.length > 0 && (
              <BatchApproveButton recordIds={tier1Ids} token={token} />
            )}
          </div>
        )}

        {/* Change list */}
        <div ref={listRef} className="flex-1 overflow-y-auto space-y-6 pr-1">
          {activeChanges.length === 0 && (
            <div className="py-12 text-center text-white/30 text-sm">
              {activeTab === "pending" ? "All caught up!" : "No decided changes yet."}
            </div>
          )}

          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <StatusBadge value={cat} variant="category" />
                <span className="text-white/30 text-xs">{grouped[cat].length}</span>
              </div>
              <div className="space-y-1">
                {grouped[cat].map((change) => {
                  const approval = getApprovalStatus(change);
                  const isSelected = selectedChangeId === change.id;
                  const changeType = change.fields.type || change.fields.change_type;
                  return (
                    <button
                      data-change-id={change.id}
                      key={change.id}
                      onClick={() => {
                        setSelectedChangeId(change.id);
                        setFeedback(null);
                        setShowQuestion(false);
                        setQuestionText("");
                        setShowTechnical(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                        isSelected
                          ? "border-l-2 border-violet-500 bg-white/5"
                          : "border-l-2 border-transparent hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${statusDotColor(approval)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white/80 truncate">
                            {getListItemTitle(changeType, change.fields.page_url, 30)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {change.fields.confidence && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                change.fields.confidence === "High"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-400/15"
                                  : change.fields.confidence === "Medium"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-400/15"
                                  : "bg-red-500/10 text-red-400 border-red-400/15"
                              }`}>
                                {change.fields.confidence}
                              </span>
                            )}
                            {change.fields.implementation_tier === "tier_1" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/20">
                                Quick win
                              </span>
                            )}
                            {change.fields.is_nav_page && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-400/20">
                                Nav page
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Non-standard categories */}
          {Object.entries(grouped)
            .filter(([cat]) => !CATEGORY_ORDER.includes(cat))
            .map(([cat, catChanges]) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <StatusBadge value={cat} variant="category" />
                  <span className="text-white/30 text-xs">{catChanges.length}</span>
                </div>
                <div className="space-y-1">
                  {catChanges.map((change) => {
                    const approval = getApprovalStatus(change);
                    const isSelected = selectedChangeId === change.id;
                    const changeType = change.fields.type || change.fields.change_type;
                    return (
                      <button
                        key={change.id}
                        data-change-id={change.id}
                        onClick={() => {
                          setSelectedChangeId(change.id);
                          setFeedback(null);
                          setShowQuestion(false);
                          setQuestionText("");
                          setShowTechnical(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                          isSelected
                            ? "border-l-2 border-violet-500 bg-white/5"
                            : "border-l-2 border-transparent hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${statusDotColor(approval)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white/80 truncate">
                              {getListItemTitle(changeType, change.fields.page_url, 30)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {change.fields.confidence && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                  change.fields.confidence === "High"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-400/15"
                                    : change.fields.confidence === "Medium"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-400/15"
                                    : "bg-red-500/10 text-red-400 border-red-400/15"
                                }`}>
                                  {change.fields.confidence}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="w-[60%] flex flex-col min-w-0">
        {!effectiveSelected ? (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
            Select a recommendation on the left to review its details and take action.
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto pb-24">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <StatusBadge value={effectiveSelected.fields.cat || effectiveSelected.fields.category || "Other"} variant="category" />
                  {effectiveSelected.fields.type && (
                    <StatusBadge value={effectiveSelected.fields.type} variant="category" />
                  )}
                  {effectiveSelected.fields.confidence && (
                    <StatusBadge value={effectiveSelected.fields.confidence} variant="confidence" />
                  )}
                  {effectiveSelected.fields.implementation_tier === "tier_1" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/20">
                      Quick win
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-semibold text-white/90">
                  {getListItemTitle(
                    effectiveSelected.fields.type || effectiveSelected.fields.change_type,
                    effectiveSelected.fields.page_url
                  )}
                </h2>
                <a
                  href={effectiveSelected.fields.page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-violet-400 hover:text-violet-300 transition-colors mt-1 block truncate"
                >
                  {effectiveSelected.fields.page_url}
                </a>
              </div>

              {/* What We Recommend */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  What We Recommend
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {effectiveSelected.fields.proposed_value || "We'll make an optimization to improve this page's search visibility."}
                </p>
              </div>

              {/* Why It Matters */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Why It Matters
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {effectiveSelected.fields.reasoning ||
                    CATEGORY_EXPLANATIONS[effectiveSelected.fields.cat || effectiveSelected.fields.category || ""] ||
                    "This change helps improve your site's search visibility."}
                </p>
              </div>

              {/* Technical Details — collapsed */}
              {(effectiveSelected.fields.current_value || effectiveSelected.fields.proposed_value) && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowTechnical(!showTechnical)}
                    className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider hover:text-white/70 transition-colors"
                  >
                    <span className={`transition-transform ${showTechnical ? "rotate-90" : ""}`}>▶</span>
                    Technical Details
                  </button>
                  {showTechnical && (
                    <div className="mt-3 space-y-3">
                      {effectiveSelected.fields.current_value && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Current value</div>
                          <pre className="text-xs text-white/60 bg-white/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                            {effectiveSelected.fields.current_value}
                          </pre>
                        </div>
                      )}
                      {effectiveSelected.fields.proposed_value && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Proposed value</div>
                          <pre className="text-xs text-emerald-300/70 bg-emerald-500/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                            {effectiveSelected.fields.proposed_value}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Question textarea */}
              {showQuestion && (
                <div className="mb-6">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
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
                      className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (effectiveSelected && questionText.trim()) {
                          applyDecision(effectiveSelected.id, "question", questionText.trim());
                        }
                      }}
                      disabled={!questionText.trim() || submitting}
                      className="px-4 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-xs text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit question
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky action bar */}
            <div className="border-t border-white/5 bg-[#08080f]/90 backdrop-blur-sm pt-4 pb-1 px-1">
              {(() => {
                const approval = getApprovalStatus(effectiveSelected);
                const isLocal = localChanges.has(effectiveSelected.id);

                // Feedback message
                if (feedback) {
                  return (
                    <div className="text-sm text-emerald-300 py-2 text-center">
                      {feedback}
                    </div>
                  );
                }

                // Already decided (not locally modified)
                if (!isLocal && approval !== "pending") {
                  if (approval === "approved") {
                    return (
                      <div className="text-sm text-white/40 py-2">
                        You approved this on {formatDate(effectiveSelected.fields.approved_at)}.
                      </div>
                    );
                  }
                  if (approval === "skipped") {
                    return (
                      <div className="text-sm text-white/40 py-2">
                        You skipped this.
                      </div>
                    );
                  }
                  if (approval === "question") {
                    return (
                      <div className="text-sm text-white/40 py-2">
                        Question pending — submitted {formatDate(effectiveSelected.fields.approved_at)}.
                      </div>
                    );
                  }
                }

                // Pending — show action buttons
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (effectiveSelected) applyDecision(effectiveSelected.id, "approved");
                      }}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>✓</span> Approve
                    </button>
                    <button
                      onClick={() => {
                        if (effectiveSelected) applyDecision(effectiveSelected.id, "skipped");
                      }}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>—</span> Skip
                    </button>
                    <button
                      onClick={() => setShowQuestion(true)}
                      disabled={submitting}
                      className="px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ?
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
