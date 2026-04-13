"use client";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BatchApproveButton } from "@/components/portal/BatchApproveButton";
import {
  getListItemTitle,
  getWhatWeRecommend,
  getWhyItMatters,
  getDocUrl,
  normalizeType,
  normalizeCat,
} from "@/lib/portal-labels";
import { ChangePreview } from "@/components/portal/ChangePreview";
import { useApprovalActions } from "./useApprovalActions";
import { ApprovalActionBar } from "./ApprovalActionBar";
import type { Change } from "@/lib/changes";

const CATEGORY_ORDER = ["Technical", "On-Page", "Content", "AI-GEO"];

// Change types that are safe to bulk-approve without individual review
// (under-the-hood fixes that don't alter visible content or appearance)
const SAFE_TYPES = ["Metadata", "Alt Text", "Canonical", "Internal Link"];
const SAFE_TYPE_SCHEMA = "Schema"; // eligible when not Critical

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

function getPageLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (!path || path === "/") return "Homepage";
    // Remove trailing slash, split, filter empty segments
    const segments = path.replace(/\/$/, "").split("/").filter(Boolean);
    if (segments.length === 0) return "Homepage";
    return segments.join(" / ");
  } catch {
    // Not a valid URL — return as-is, trimmed
    if (!url || url === "/") return "Homepage";
    return url;
  }
}

function isSitewide(url: string): boolean {
  try {
    const u = new URL(url);
    return !u.pathname || u.pathname === "/";
  } catch {
    return false;
  }
}

export function ApprovalMasterDetail(props: ApprovalMasterDetailProps) {
  return (
    <Suspense fallback={
      <div className="flex gap-0 h-[calc(100vh-12rem)]">
        <div className="w-[40%] flex items-center justify-center text-slate-400 text-sm">Loading...</div>
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
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [pageFilter, setPageFilter] = useState<string>("");
  const [pageFilterOpen, setPageFilterOpen] = useState(false);
  // Track which page groups are collapsed (by "cat::pageUrl")
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showSafeList, setShowSafeList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pageFilterRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const onDecisionApplied = useCallback((changeId: string, decision: string) => {
    setLocalChanges((prev) => {
      const next = new Map(prev);
      next.set(changeId, { approval: decision, client_notes: "" });
      return next;
    });

    setTimeout(() => {
      setShowQuestion(false);
      setQuestionText("");
      setShowTechnical(false);
      if (decision !== "approved") {
        const currentIdx = effectivePendingRef.current.findIndex((c) => c.id === changeId);
        const nextPending = effectivePendingRef.current.find((c, i) => i > currentIdx && !localChanges.has(c.id));
        if (nextPending) {
          setSelectedChangeId(nextPending.id);
        } else {
          const firstPending = effectivePendingRef.current.find((c) => !localChanges.has(c.id));
          setSelectedChangeId(firstPending?.id ?? null);
        }
        router.refresh();
      }
    }, decision === "skipped" ? 1500 : 2500);
  }, [localChanges, router]);

  const onUndoApplied = useCallback((changeId: string) => {
    setLocalChanges((prev) => {
      const next = new Map(prev);
      next.set(changeId, { approval: "pending", client_notes: "" });
      return next;
    });
    setActiveTab("pending");
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
    ? pendingByPriority.filter((c) => normalizeCat(c.fields.cat || c.fields.category) === categoryFilter)
    : pendingByPriority;
  const effectiveDecided = categoryFilter
    ? decidedByPriority.filter((c) => normalizeCat(c.fields.cat || c.fields.category) === categoryFilter)
    : decidedByPriority;

  const effectivePendingRef = useRef(effectivePending);
  effectivePendingRef.current = effectivePending;

  const activeChanges = activeTab === "pending" ? effectivePending : effectiveDecided;

  const grouped: Record<string, Change[]> = {};
  for (const c of activeChanges) {
    const cat = normalizeCat(c.fields.cat || c.fields.category) || "Other";
    const mapped = getEffectiveChange(c);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(mapped);
  }

  const selectedChange = selectedChangeId
    ? [...effectivePending, ...effectiveDecided].find((c) => c.id === selectedChangeId)
    : null;
  const effectiveSelected = selectedChange ? getEffectiveChange(selectedChange) : null;

  const getApprovalStatus = (change: Change): string => {
    const local = localChanges.get(change.id);
    if (local) return local.approval || change.fields.approval;
    return change.fields.approval || change.fields.approval_status;
  };

  const priorityDotColor = (priority: string) => {
    if (priority === "Critical") return "bg-red-500";
    if (priority === "High") return "bg-orange-500";
    if (priority === "Medium") return "bg-amber-400";
    if (priority === "Low") return "bg-emerald-500";
    return "bg-slate-400";
  };

  const truncateUrl = (url: string) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  // When a change is selected, ensure its page group is expanded
  useEffect(() => {
    if (!selectedChangeId) return;
    const change = [...effectivePending, ...effectiveDecided].find((c) => c.id === selectedChangeId);
    if (!change) return;
    const cat = normalizeCat(change.fields.cat || change.fields.category) || "Other";
    const url = change.fields.page_url || "";
    const key = `${cat}::${url}`;
    setCollapsedGroups((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, [selectedChangeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderListItems = (catChanges: Change[]) =>
    catChanges.map((change) => {
      const approval = getApprovalStatus(change);
      const isSelected = selectedChangeId === change.id;
      const changeType = normalizeType(change.fields.type || change.fields.change_type);
      const isDecided = activeTab === "decided";
      let decidedBorder = "border-l-transparent";
      if (isDecided) {
        if (approval === "approved") decidedBorder = "border-l-emerald-400";
        else if (approval === "skipped") decidedBorder = "border-l-slate-200 opacity-50";
        else if (approval === "question") decidedBorder = "border-l-blue-400";
      }

      return (
        <button
          data-change-id={change.id}
          key={change.id}
          onClick={() => {
            setSelectedChangeId(change.id);
            clearFeedback();
            setShowQuestion(false);
            setQuestionText("");
            setShowTechnical(false);
            setConfirmApprove(false);
          }}
          className={`w-full text-left px-4 py-3 cursor-pointer transition-all duration-150 border-l-2 ${
            isSelected
              ? "border-l-indigo-500 bg-indigo-50/60"
              : isDecided
              ? `${decidedBorder} hover:bg-slate-50`
              : "border-l-transparent hover:bg-slate-50 hover:border-l-slate-300"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDotColor(change.fields.priority)}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-800 truncate">
                {getListItemTitle(changeType, change.fields.page_url, 30, change.fields.change_title, false, change.fields)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {truncateUrl(change.fields.page_url || "")}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {change.fields.priority && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    change.fields.priority === "Critical"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : change.fields.priority === "High"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : change.fields.priority === "Medium"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {change.fields.priority}
                  </span>
                )}
                {change.fields.implementation_tier === "tier_1" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Tier 1
                  </span>
                )}
                {change.fields.is_nav_page && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Nav page
                  </span>
                )}
                {isDecided && (approval === "approved" || approval === "skipped") && (
                  <>
                    <span className={`text-[10px] ${approval === "approved" ? "text-emerald-600" : "text-slate-500"}`}>{approval === "approved" ? "✓" : "—"}</span>
                    {!change.fields.implemented_at && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUndo(change.id);
                        }}
                        disabled={submitting}
                        className="text-[10px] text-slate-400 hover:text-red-600 underline underline-offset-2 transition-colors ml-0.5 disabled:opacity-50"
                      >
                        {approval === "approved" ? "Undo" : "Unskip"}
                      </button>
                    )}
                  </>
                )}
                {isDecided && approval === "question" && (
                  <span className="text-[10px] text-blue-600">?</span>
                )}
              </div>
            </div>
          </div>
        </button>
      );
    });

  // Build page groups for a category's changes
  const buildPageGroups = (catChanges: Change[], cat: string) => {
    const pageMap = new Map<string, Change[]>();
    for (const c of catChanges) {
      const url = c.fields.page_url || "";
      if (!pageMap.has(url)) pageMap.set(url, []);
      pageMap.get(url)!.push(c);
    }

    // Sort: root/homepage first, then nav pages, then by count desc
    const entries = Array.from(pageMap.entries()).sort(([urlA, changesA], [urlB, changesB]) => {
      const siteA = isSitewide(urlA);
      const siteB = isSitewide(urlB);
      if (siteA && !siteB) return -1;
      if (!siteA && siteB) return 1;
      const navA = changesA.some((c) => c.fields.is_nav_page);
      const navB = changesB.some((c) => c.fields.is_nav_page);
      if (navA && !navB) return -1;
      if (!navA && navB) return 1;
      return changesB.length - changesA.length;
    });

    const needle = pageFilter.trim().toLowerCase();
    const filteredEntries = needle
      ? entries.filter(([url]) => {
          const label = (!url || url.trim() === "") ? "sitewide" : getPageLabel(url).toLowerCase();
          return label.includes(needle) || url.toLowerCase().includes(needle);
        })
      : entries;

    return filteredEntries.map(([url, pageChanges]) => {
      const key = `${cat}::${url}`;
      const hasCritical = pageChanges.some((c) => c.fields.priority === "Critical");
      const isNavPage = pageChanges.some((c) => c.fields.is_nav_page);
      // Auto-expand all groups when filtering so matches are visible
      const defaultExpanded = hasCritical || isNavPage || filteredEntries.length === 1 || !!needle;

      return { url, pageChanges, key, hasCritical, isNavPage, defaultExpanded };
    });
  };

  // Compute triage card data — safe types that can be bulk-approved without review
  const safeIds = effectivePending
    .filter((c) => {
      const t = normalizeType(c.fields.type || c.fields.change_type);
      if (SAFE_TYPES.includes(t)) return true;
      if (t === SAFE_TYPE_SCHEMA && c.fields.priority !== "Critical") return true;
      return false;
    })
    .map((c) => c.id);

  const safeTypeBreakdown: { type: string; count: number }[] = (() => {
    const counts = new Map<string, number>();
    for (const id of safeIds) {
      const c = effectivePending.find((x) => x.id === id);
      if (!c) continue;
      const t = normalizeType(c.fields.type || c.fields.change_type) || "Other";
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  })();

  const renderCategorySection = (cat: string, catChanges: Change[]) => {
    const pageGroups = buildPageGroups(catChanges, cat);

    return (
      <div key={cat}>
        {/* Sticky category header */}
        <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 z-10 bg-[#FAFAFB]/90 backdrop-blur-sm py-2 border-b border-slate-100">
          <StatusBadge value={cat} variant="category" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            ({catChanges.length})
          </span>
        </div>

        {/* Page groups */}
        <div className="space-y-1 mt-1">
          {pageGroups.map(({ url, pageChanges, key, hasCritical, isNavPage, defaultExpanded }) => {
            const collapsed = collapsedGroups.has(key)
              ? true
              : collapsedGroups.has(key + "__open")
              ? false
              : !defaultExpanded;

            // Only show "Sitewide" for truly empty/null page_url; homepage shows as "Homepage"
            const label = (!url || url.trim() === "") ? "Sitewide" : getPageLabel(url);

            return (
              <div key={key} className="rounded-xl overflow-hidden">
                {/* Page group header */}
                <button
                  onClick={() => {
                    const currentlyCollapsed = collapsedGroups.has(key)
                      ? true
                      : collapsedGroups.has(key + "__open")
                      ? false
                      : !defaultExpanded;

                    setCollapsedGroups((prev) => {
                      const next = new Set(prev);
                      if (currentlyCollapsed) {
                        next.delete(key);
                        next.add(key + "__open");
                      } else {
                        next.add(key);
                        next.delete(key + "__open");
                      }
                      return next;
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100/60 transition-colors rounded-lg"
                >
                  <span className={`text-[10px] text-slate-400 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}>▶</span>
                  <span className="text-xs font-medium text-slate-600 flex-1 truncate">{label}</span>
                  {isNavPage && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">nav</span>
                  )}
                  {hasCritical && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 flex-shrink-0">Critical</span>
                  )}
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{pageChanges.length} {pageChanges.length === 1 ? "item" : "items"}</span>
                </button>

                {/* Page group items */}
                {!collapsed && (
                  <div className="ml-3 border-l border-slate-100 pl-1">
                    {renderListItems(pageChanges)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-12rem)]">
      {/* ── Left Panel (List) ── */}
      <div className="w-[40%] flex flex-col min-w-0 border-r border-slate-200 pr-6">
        {/* Segmented control */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4">
          {(["pending", "decided"] as const).map((tab) => {
            const count = tab === "pending" ? effectivePending.length : effectiveDecided.length;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedChangeId(null);
                  clearFeedback();
                  setShowQuestion(false);
                  setShowTechnical(false);
                }}
                className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeTab === tab
                    ? "bg-white text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                style={activeTab === tab ? { boxShadow: "var(--shadow-xs)" } : {}}
              >
                {tab === "pending" ? "Pending" : "Decided"}
                <span className={`ml-1.5 text-xs ${
                  activeTab === tab ? "text-slate-400" : "text-slate-400"
                }`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Overview bar — always shown on pending tab */}
        {activeTab === "pending" && (
          <div className="mb-3 px-1 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-slate-500">
                <span className="text-slate-900 font-semibold">{effectivePending.length}</span> pending
                {priorityFilter !== "All" && (
                  <span className="text-slate-400 ml-1">({priorityFilter})</span>
                )}
                {pageFilter && (
                  <span className="text-slate-400 ml-1">· page filter active</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                {(["All", "Critical", "High", "Medium", "Low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all duration-150 border ${
                      priorityFilter === p
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {/* Page filter toggle */}
                <button
                  onClick={() => {
                    const next = !pageFilterOpen;
                    setPageFilterOpen(next);
                    if (next) {
                      setTimeout(() => pageFilterRef.current?.focus(), 50);
                    } else {
                      setPageFilter("");
                    }
                  }}
                  className={`w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 border ${
                    pageFilterOpen || pageFilter
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                  }`}
                  title="Filter by page"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 2h10M3 6h6M5 10h2" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Page filter input */}
            {pageFilterOpen && (
              <div className="relative">
                <input
                  ref={pageFilterRef}
                  type="text"
                  value={pageFilter}
                  onChange={(e) => setPageFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setPageFilter("");
                      setPageFilterOpen(false);
                    }
                  }}
                  placeholder="Filter by page (e.g. services, /about/)"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
                />
                {pageFilter && (
                  <button
                    onClick={() => setPageFilter("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Change list */}
        <div ref={listRef} className="flex-1 overflow-y-auto pr-1">
          {activeChanges.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              {activeTab === "pending" ? "All caught up!" : "No decided changes yet."}
            </div>
          )}

          <div className="space-y-6">
            {/* Triage card — bulk approve safe types before reviewing the rest */}
            {activeTab === "pending" && safeIds.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4" style={{ boxShadow: "var(--shadow-xs)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-slate-800">Pre-screened Fixes</div>
                  <button
                    onClick={() => setShowSafeList((p) => !p)}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {showSafeList ? "Hide ▲" : "Review ▼"}
                  </button>
                </div>
                <div className="text-xs text-slate-500 mb-3 leading-relaxed">
                  {safeIds.length} changes that are safe to approve without individual review —
                  metadata tags, schema markup, image alt labels, and canonical links.
                  None of these affect how your site looks or functions.
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {safeTypeBreakdown.map(({ type, count }) => (
                    <span
                      key={type}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500"
                    >
                      {type} · {count}
                    </span>
                  ))}
                </div>

                {/* Expandable list so the user can review each item before bulk-approving */}
                {showSafeList && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-emerald-100 bg-white divide-y divide-slate-50">
                    {effectivePending
                      .filter((c) => safeIds.includes(c.id))
                      .map((c) => {
                        const changeType = normalizeType(c.fields.type || c.fields.change_type);
                        const isSelected = selectedChangeId === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedChangeId(c.id);
                              clearFeedback();
                              setShowQuestion(false);
                              setQuestionText("");
                              setShowTechnical(false);
                              setConfirmApprove(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${priorityDotColor(c.fields.priority)}`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-slate-800 truncate">
                                  {getListItemTitle(changeType, c.fields.page_url, 40, c.fields.change_title, false, c.fields)}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {truncateUrl(c.fields.page_url || "")}
                                </div>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0 mt-0.5">
                                {changeType}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}

                <BatchApproveButton
                  recordIds={safeIds}
                  token={token}
                  label={`Approve all ${safeIds.length} fixes`}
                />
              </div>
            )}

            {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) =>
              renderCategorySection(cat, grouped[cat])
            )}

            {/* Non-standard categories */}
            {Object.entries(grouped)
              .filter(([cat]) => !CATEGORY_ORDER.includes(cat))
              .map(([cat, catChanges]) => renderCategorySection(cat, catChanges))}
          </div>
        </div>
      </div>

      {/* ── Right Panel (Detail) ── */}
      <div className="w-[60%] flex flex-col min-w-0 min-h-0 bg-slate-50/40 border-l border-slate-100">
        {!effectiveSelected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl text-slate-300 mb-2">◇</div>
              <div className="text-sm text-slate-400">Select a recommendation</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-8 pb-6 min-h-0">
              {(() => {
                const fields = effectiveSelected.fields;
                const type = normalizeType(fields.type || fields.change_type);
                const cat = normalizeCat(fields.cat || fields.category);
                const page_url = fields.page_url;
                const whyText = getWhyItMatters(fields);
                return <>
              {/* Badges — max 3: category, type (if different from cat), nav page */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <StatusBadge value={cat || "Other"} variant="category" />
                {type && type !== cat && (
                  <StatusBadge value={type} variant="category" />
                )}
                {fields.is_nav_page && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Nav page</span>
                )}
              </div>

              {/* Title — short, readable page name */}
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                {getListItemTitle(type, page_url, undefined, fields.change_title, true, fields)}
              </h2>

              {/* URL pill — shows domain + path */}
              <a
                href={page_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono hover:bg-indigo-100 transition-colors mb-5 max-w-full"
              >
                <span className="truncate">{(() => {
                  try {
                    const u = new URL(page_url);
                    const path = u.pathname === '/' ? '' : u.pathname;
                    const display = u.hostname + path;
                    return display.length > 60 ? display.slice(0, 57) + '...' : display;
                  } catch { return page_url; }
                })()}</span>
                <span className="flex-shrink-0">↗</span>
              </a>

              <div className="space-y-5">
                {/* What We Recommend */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">What We Recommend</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{getWhatWeRecommend(fields)}</p>

                  {/* Type-specific visual preview */}
                  <ChangePreview fields={fields} cat={cat} type={type} />
                </div>

                {/* View the Draft */}
                {getDocUrl(fields) && (
                  <a href={getDocUrl(fields)!} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 transition-colors px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100">
                    View the Draft ↗
                  </a>
                )}

                {/* Why It Matters — single text block, hidden if empty */}
                {whyText && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Why It Matters</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{whyText}</p>
                  </div>
                )}

                {/* What happens next? */}
                <div className="text-xs text-slate-400 pt-6 pb-3 border-t border-slate-200">
                  {getApprovalStatus(effectiveSelected) === 'pending'
                    ? "When you approve, we'll implement this change within 48 hours. You'll see it in your next monthly report."
                    : ''}
                </div>
              </div>

                </>;
              })()}

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
                        if (effectiveSelected && questionText.trim()) {
                          applyDecision(effectiveSelected.id, "question", questionText.trim(), contactEmail);
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

            {/* Action bar — flex-pinned to bottom, always visible */}
            <div className="flex-shrink-0 px-8 py-4 border-t border-slate-200 bg-white/90 backdrop-blur-sm">
              <ApprovalActionBar
                changeId={effectiveSelected.id}
                approval={getApprovalStatus(effectiveSelected)}
                approvedAt={effectiveSelected.fields.approved_at}
                implementedAt={effectiveSelected.fields.implemented_at}
                submitting={submitting}
                feedback={feedback}
                error={error}
                confirmApprove={confirmApprove}
                undoTarget={undoTarget}
                isLocalDecision={localChanges.has(effectiveSelected.id)}
                onApprove={() => setConfirmApprove(true)}
                onSkip={() => applyDecision(effectiveSelected.id, "skipped", undefined, contactEmail)}
                onQuestion={() => setShowQuestion(true)}
                onConfirmApprove={() => applyDecision(effectiveSelected.id, "approved", undefined, contactEmail)}
                onCancelConfirm={() => setConfirmApprove(false)}
                onUndo={handleUndo}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
