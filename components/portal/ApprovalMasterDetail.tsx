"use client";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { BatchApproveButton } from "@/components/portal/BatchApproveButton";
import {
  getChangeTitle,
  getListItemTitle,
  CATEGORY_EXPLANATIONS,
  getWhatWeRecommend,
  getWhyItMatters,
  getTechnicalCurrent,
  getTechnicalProposed,
  hasTechnicalDetails,
  getDocUrl,
} from "@/lib/portal-labels";
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
      <div className="flex gap-0 h-[calc(100vh-12rem)]">
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
  const router = useRouter();
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "decided">("pending");
  const [localChanges, setLocalChanges] = useState<Map<string, LocalDecision>>(new Map());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const initialSelected = searchParams.get("selected");
  useEffect(() => {
    if (initialSelected) {
      setSelectedChangeId(initialSelected);
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

  const pendingByPriority = priorityFilter === "All"
    ? changes
    : changes.filter((c) => c.fields.priority === priorityFilter);
  const decidedByPriority = priorityFilter === "All"
    ? decidedChanges
    : decidedChanges.filter((c) => c.fields.priority === priorityFilter);

  const effectivePending = categoryFilter
    ? pendingByPriority.filter((c) => (c.fields.cat || c.fields.category) === categoryFilter)
    : pendingByPriority;
  const effectiveDecided = categoryFilter
    ? decidedByPriority.filter((c) => (c.fields.cat || c.fields.category) === categoryFilter)
    : decidedByPriority;

  const activeChanges = activeTab === "pending" ? effectivePending : effectiveDecided;

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
    setError(null);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: changeId, decision, notes, token }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error ${res.status}`);
      }
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
        setError(null);
        setShowQuestion(false);
        setQuestionText("");
        setShowTechnical(false);
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
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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

  const renderListItems = (catChanges: Change[]) =>
    catChanges.map((change) => {
      const approval = getApprovalStatus(change);
      const isSelected = selectedChangeId === change.id;
      const changeType = change.fields.type || change.fields.change_type;
      const isDecided = activeTab === "decided";
      let decidedBorder = "border-l-transparent";
      if (isDecided) {
        if (approval === "approved") decidedBorder = "border-l-emerald-400/40";
        else if (approval === "skipped") decidedBorder = "border-l-white/10 opacity-50";
        else if (approval === "question") decidedBorder = "border-l-blue-400/40";
      }

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
          className={`w-full text-left px-4 py-3 cursor-pointer transition-all duration-150 border-l-2 ${
            isSelected
              ? "border-l-violet-400 bg-white/[0.06]"
              : isDecided
              ? `${decidedBorder} hover:bg-white/[0.04]`
              : "border-l-transparent hover:bg-white/[0.04] hover:border-l-white/10"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDotColor(approval)}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white/80 truncate">
                {getListItemTitle(changeType, change.fields.page_url, 30)}
              </div>
              <div className="text-xs text-white/30 mt-0.5 truncate">
                {truncateUrl(change.fields.page_url || "")}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {change.fields.priority && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    change.fields.priority === "Critical"
                      ? "bg-red-500/15 text-red-400 border-red-400/20"
                      : change.fields.priority === "High"
                      ? "bg-amber-500/10 text-amber-400 border-amber-400/15"
                      : change.fields.priority === "Medium"
                      ? "bg-white/[0.05] text-white/40 border-white/[0.08]"
                      : "bg-white/[0.03] text-white/25 border-white/[0.06]"
                  }`}>
                    {change.fields.priority}
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
                {isDecided && approval === "approved" && (
                  <span className="text-[10px] text-emerald-400">✓</span>
                )}
                {isDecided && approval === "question" && (
                  <span className="text-[10px] text-blue-400">?</span>
                )}
              </div>
            </div>
          </div>
        </button>
      );
    });

  return (
    <div className="flex gap-0 h-[calc(100vh-12rem)]">
      {/* ── Left Panel (List) ── */}
      <div className="w-[40%] flex flex-col min-w-0 border-r border-white/[0.06] pr-6">
        {/* Segmented control */}
        <div className="inline-flex rounded-xl bg-white/[0.04] p-1 mb-4">
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
                className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeTab === tab
                    ? "bg-white/[0.08] rounded-lg text-white/90 shadow-sm"
                    : "text-white/30 hover:text-white/50"
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

        {/* Overview bar — always shown on pending tab */}
        {activeTab === "pending" && (
          <div className="flex items-center justify-between gap-3 mb-3 px-1 flex-wrap">
            <span className="text-sm text-white/60">
              <span className="text-white/90 font-semibold">{effectivePending.length}</span> pending
              {priorityFilter !== "All" && (
                <span className="text-white/30 ml-1">({priorityFilter})</span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              {(["All", "Critical", "High", "Medium", "Low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                    priorityFilter === p
                      ? "bg-violet-500/20 border border-violet-400/30 text-violet-300"
                      : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {tier1Ids.length > 0 && (
              <BatchApproveButton recordIds={tier1Ids} token={token} />
            )}
          </div>
        )}

        {/* Change list */}
        <div ref={listRef} className="flex-1 overflow-y-auto pr-1">
          {activeChanges.length === 0 && (
            <div className="py-12 text-center text-white/30 text-sm">
              {activeTab === "pending" ? "All caught up!" : "No decided changes yet."}
            </div>
          )}

          <div className="space-y-6">
            {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
              <div key={cat}>
                {/* Sticky category header */}
                <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 z-10 bg-[#08080f]/80 backdrop-blur-sm py-2 border-b border-white/[0.06]">
                  <StatusBadge value={cat} variant="category" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
                    ({grouped[cat].length})
                  </span>
                </div>
                <div className="space-y-1 mt-3">
                  {renderListItems(grouped[cat])}
                </div>
              </div>
            ))}

            {/* Non-standard categories */}
            {Object.entries(grouped)
              .filter(([cat]) => !CATEGORY_ORDER.includes(cat))
              .map(([cat, catChanges]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 z-10 bg-[#08080f]/80 backdrop-blur-sm py-2 border-b border-white/[0.06]">
                    <StatusBadge value={cat} variant="category" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
                      ({catChanges.length})
                    </span>
                  </div>
                  <div className="space-y-1 mt-3">
                    {renderListItems(catChanges)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel (Detail) ── */}
      <div className="w-[60%] flex flex-col min-w-0 bg-white/[0.03] border-l border-white/[0.06]">
        {!effectiveSelected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl text-white/10 mb-2">◇</div>
              <div className="text-sm text-white/20">Select a recommendation</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-8 pb-24">
              {/* Badges row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
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

              {/* Title */}
              <h2 className="text-xl font-semibold text-white/90 mb-1">
                {getListItemTitle(
                  effectiveSelected.fields.type || effectiveSelected.fields.change_type,
                  effectiveSelected.fields.page_url
                )}
              </h2>
              <a
                href={effectiveSelected.fields.page_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-400/60 hover:text-violet-400 transition-colors block truncate mb-8"
              >
                {effectiveSelected.fields.page_url}
              </a>

              <div className="space-y-6">
                {/* What We Recommend */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
                    What We Recommend
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {getWhatWeRecommend(effectiveSelected.fields)}
                  </p>
                </div>

                {/* View the Draft — only for content changes with a doc */}
                {getDocUrl(effectiveSelected.fields) && (
                  <div>
                    <a
                      href={getDocUrl(effectiveSelected.fields)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-violet-400/80 hover:text-violet-400 transition-colors duration-150 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-400/15 hover:bg-violet-500/15"
                    >
                      View the Draft ↗
                    </a>
                  </div>
                )}

                {/* Why It Matters */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
                    Why It Matters
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed italic">
                    {getWhyItMatters(effectiveSelected.fields)}
                  </p>
                </div>

                {/* Technical Details — collapsed, only when there's raw data to show */}
                {hasTechnicalDetails(effectiveSelected.fields, getWhatWeRecommend(effectiveSelected.fields)) && (
                  <div>
                    <button
                      onClick={() => setShowTechnical(!showTechnical)}
                      className="flex items-center gap-2 text-xs text-white/20 hover:text-white/40 transition-colors duration-150"
                    >
                      <span className={`transition-transform duration-150 ${showTechnical ? "rotate-90" : ""}`}>▶</span>
                      Technical Details
                    </button>
                    {showTechnical && (() => {
                      const techCurrent = getTechnicalCurrent(effectiveSelected.fields);
                      const techProposed = getTechnicalProposed(effectiveSelected.fields, getWhatWeRecommend(effectiveSelected.fields));
                      return (
                        <div className="mt-3 space-y-3">
                          {techCurrent && (
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Current</div>
                              <pre className="text-xs font-mono text-white/60 bg-red-500/5 border border-red-400/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                                {techCurrent}
                              </pre>
                            </div>
                          )}
                          {techProposed && (
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Proposed</div>
                              <pre className="text-xs font-mono text-emerald-300/70 bg-emerald-500/5 border border-emerald-400/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
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
                        if (effectiveSelected && questionText.trim()) {
                          applyDecision(effectiveSelected.id, "question", questionText.trim());
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

            {/* Sticky action bar with gradient fade */}
            <div className="sticky bottom-0 pt-4 pb-2 px-8 bg-gradient-to-t from-[#08080f] via-[#08080f]/95 to-transparent">
              {(() => {
                const approval = getApprovalStatus(effectiveSelected);
                const isLocal = localChanges.has(effectiveSelected.id);

                if (feedback) {
                  return (
                    <div className="text-sm text-emerald-300 py-2 text-center">
                      {feedback}
                    </div>
                  );
                }

                if (error) {
                  return (
                    <div className="text-sm text-red-300 py-2 text-center">
                      {error}
                    </div>
                  );
                }

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

                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (effectiveSelected) applyDecision(effectiveSelected.id, "approved");
                      }}
                      disabled={submitting}
                      className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-emerald-500/20 border border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/30 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => {
                        if (effectiveSelected) applyDecision(effectiveSelected.id, "skipped");
                      }}
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
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
