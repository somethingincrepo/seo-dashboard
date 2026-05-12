"use client";

import { useState, useCallback } from "react";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { PageCreationSuggestion, PageCreationStatus } from "@/lib/supabase";

function suggestionLimit(pkg: string): number {
  return PACKAGES[(pkg as PackageTier) in PACKAGES ? (pkg as PackageTier) : "starter"].page_creation_suggestions;
}

type UiStatus = "suggested" | "generating" | "content_ready" | "approved" | "published" | "skipped" | "failed";

function getUiStatus(s: PageCreationSuggestion): UiStatus {
  if (s.status === "skipped" || s.portal_approval === "skipped") return "skipped";
  if (s.status === "failed") return "failed";
  if (s.status === "published") return "published";
  if (s.status === "approved_for_publish") return "approved";
  if (s.status === "content_ready") return "content_ready";
  if (s.status === "generating") return "generating";
  return "suggested";
}

const STATUS_CONFIG: Record<UiStatus, { label: string; dot: string; badge: string }> = {
  suggested: { label: "New Suggestion", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 ring-slate-200/60" },
  generating: { label: "Generating Content", dot: "bg-amber-400 animate-pulse", badge: "bg-amber-50 text-amber-700 ring-amber-200/60" },
  content_ready: { label: "Content Ready for Review", dot: "bg-indigo-400", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200/60" },
  approved: { label: "Approved for Publishing", dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
  published: { label: "Published", dot: "bg-green-500", badge: "bg-green-50 text-green-700 ring-green-200/60" },
  skipped: { label: "Skipped", dot: "bg-slate-300", badge: "bg-slate-50 text-slate-400 ring-slate-200/60" },
  failed: { label: "Failed", dot: "bg-red-400", badge: "bg-red-50 text-red-700 ring-red-200/60" },
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  "Industry Page":    "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/60",
  "Location Page":    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/60",
  "Service Page":     "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/60",
  "Use-Case Page":    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60",
  "Job Title Page":   "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/60",
  "Comparison Page":  "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/60",
};

function pageTypeColor(type: string): string {
  return PAGE_TYPE_COLORS[type] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/60";
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 px-10 py-3 bg-slate-50 border-b border-slate-100">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-[11px] tabular-nums text-slate-400">{count}</span>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  token,
  onAction,
}: {
  suggestion: PageCreationSuggestion;
  token: string;
  onAction: (id: string, newStatus: PageCreationStatus) => void;
}) {
  const uiStatus = getUiStatus(suggestion);
  const { label, dot, badge } = STATUS_CONFIG[uiStatus];
  const [loading, setLoading] = useState<"approve" | "skip" | "approveContent" | null>(null);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  const postAction = useCallback(
    async (action: "approve" | "skip" | "approveContent") => {
      setLoading(action);
      try {
        const endpoint =
          action === "skip"
            ? `/api/portal/page-creation/${suggestion.id}/skip`
            : action === "approveContent"
            ? `/api/portal/page-creation/${suggestion.id}/approve-content`
            : `/api/portal/page-creation/${suggestion.id}/approve`;
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const nextStatus: PageCreationStatus =
          action === "skip"
            ? "skipped"
            : action === "approveContent"
            ? "approved_for_publish"
            : "generating";
        onAction(suggestion.id, nextStatus);
      } finally {
        setLoading(null);
      }
    },
    [suggestion.id, token, onAction]
  );

  const isSkipped = uiStatus === "skipped";
  const isTerminal = uiStatus === "approved" || uiStatus === "published" || uiStatus === "skipped";

  return (
    <div className={`border border-slate-200 rounded-xl bg-white overflow-hidden shadow-[0_1px_3px_0_rgba(16,24,40,0.05)] ${isSkipped ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pageTypeColor(suggestion.page_type)}`}>
              {suggestion.page_type}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
              {suggestion.target_keyword}
            </span>
          </div>
          <h3 className="text-[17px] font-semibold text-slate-900 leading-snug">{suggestion.page_title}</h3>
          <p className="text-[12px] font-mono text-slate-400 mt-1">{suggestion.suggested_slug}</p>
        </div>
        <div className="shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
            {label}
          </span>
        </div>
      </div>

      {/* Reasoning */}
      {uiStatus === "suggested" && (
        <div className="px-6 pb-4">
          <p className="text-[14px] text-slate-600 leading-[1.65]">{suggestion.reasoning}</p>
        </div>
      )}

      {/* Generated content preview (content_ready state) */}
      {uiStatus === "content_ready" && suggestion.generated_h1 && (
        <div className="px-6 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meta Title</p>
              <p className="text-[13px] text-slate-800">{suggestion.generated_meta_title ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meta Description</p>
              <p className="text-[13px] text-slate-800">{suggestion.generated_meta_description ?? "—"}</p>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">H1</p>
            <p className="text-[15px] font-semibold text-slate-900">{suggestion.generated_h1}</p>
          </div>
          {suggestion.generated_body && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Page Body
                  {suggestion.generated_word_count ? ` · ${suggestion.generated_word_count.toLocaleString()} words` : ""}
                </span>
                <button
                  onClick={() => setBodyExpanded((v) => !v)}
                  className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {bodyExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
              <div
                className={`px-6 py-4 overflow-y-auto transition-all ${bodyExpanded ? "max-h-[600px]" : "max-h-48"} text-[14px] text-slate-700 leading-[1.7] [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-3 [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_li]:mb-1`}
                dangerouslySetInnerHTML={{ __html: suggestion.generated_body }}
              />
            </div>
          )}
        </div>
      )}

      {/* Reasoning strip on approved/published */}
      {(uiStatus === "approved" || uiStatus === "published") && (
        <div className="px-6 pb-4">
          <p className="text-[13px] text-slate-500 leading-[1.65]">{suggestion.reasoning}</p>
        </div>
      )}

      {/* Action footer */}
      {!isTerminal && (
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">
          {uiStatus === "suggested" && (
            <>
              <button
                onClick={() => postAction("approve")}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading === "approve" ? "Approving…" : "Approve & Generate Content"}
              </button>
              <button
                onClick={() => postAction("skip")}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {loading === "skip" ? "Skipping…" : "Skip"}
              </button>
            </>
          )}
          {uiStatus === "generating" && (
            <p className="text-[13px] text-slate-500 italic">Content is being generated — check back shortly.</p>
          )}
          {uiStatus === "content_ready" && (
            <>
              <button
                onClick={() => postAction("approveContent")}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading === "approveContent" ? "Approving…" : "Approve for Publishing"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="px-10 py-16 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-slate-800 mb-1">No suggestions yet</h3>
      <p className="text-[13px] text-slate-500 max-w-xs">
        Page creation suggestions are generated after your site audit completes. They&apos;ll appear here once ready.
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PageCreationSuggestions({
  items,
  historicalItems,
  token,
  clientPackage,
}: {
  items: PageCreationSuggestion[];
  historicalItems: PageCreationSuggestion[];
  token: string;
  clientPackage: string;
}) {
  const limit = suggestionLimit(clientPackage);

  const [localItems, setLocalItems] = useState(items);
  const [localHistorical, setLocalHistorical] = useState(historicalItems);

  const handleAction = useCallback((id: string, newStatus: PageCreationStatus) => {
    const update = (list: PageCreationSuggestion[]) =>
      list.map((s) => (s.id === id ? { ...s, status: newStatus } : s));
    setLocalItems((prev) => update(prev));
    setLocalHistorical((prev) => update(prev));
  }, []);

  const allEmpty = localItems.length === 0 && localHistorical.length === 0;

  return (
    <div className="flex-1">
      {allEmpty ? (
        <EmptyState />
      ) : (
        <>
          {localItems.length > 0 && (
            <>
              <SectionHeader label={`This month · ${localItems.length} of ${limit}`} count={localItems.length} />
              <div className="px-10 py-6 space-y-4">
                {localItems.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} token={token} onAction={handleAction} />
                ))}
              </div>
            </>
          )}
          {localHistorical.length > 0 && (
            <>
              <SectionHeader label="Previous months" count={localHistorical.length} />
              <div className="px-10 py-6 space-y-4">
                {localHistorical.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} token={token} onAction={handleAction} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
