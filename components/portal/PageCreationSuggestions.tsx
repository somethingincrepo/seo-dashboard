"use client";

import { useState, useCallback } from "react";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { PageCreationSuggestion, PageCreationStatus } from "@/lib/supabase";
import { PagePreviewModal } from "./PagePreviewModal";

function suggestionLimit(pkg: string): number {
  return PACKAGES[(pkg as PackageTier) in PACKAGES ? (pkg as PackageTier) : "starter"].page_creation_suggestions;
}

const PAGE_TYPE_COLORS: Record<string, string> = {
  "Industry Page":   "bg-violet-50 text-violet-700 ring-violet-200/60",
  "Location Page":   "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  "Service Page":    "bg-blue-50 text-blue-700 ring-blue-200/60",
  "Use-Case Page":   "bg-amber-50 text-amber-700 ring-amber-200/60",
  "Job Title Page":  "bg-indigo-50 text-indigo-700 ring-indigo-200/60",
  "Comparison Page": "bg-rose-50 text-rose-700 ring-rose-200/60",
};

function PageTypePill({ type }: { type: string }) {
  const cls = PAGE_TYPE_COLORS[type] ?? "bg-slate-100 text-slate-600 ring-slate-200/60";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${cls}`}>
      {type}
    </span>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return null; }
}

// ── Pipeline kanban at the top ────────────────────────────────────────────────

const STAGES = [
  { key: "suggested",           label: "Suggested",        color: "border-slate-300 text-slate-600"  },
  { key: "generating",          label: "Generating",       color: "border-amber-400 text-amber-700"  },
  { key: "content_ready",       label: "Ready to Review",  color: "border-indigo-400 text-indigo-700"},
  { key: "approved_for_publish",label: "Approved",         color: "border-violet-400 text-violet-700"},
  { key: "published",           label: "Published",        color: "border-emerald-500 text-emerald-700"},
] as const;

function Pipeline({
  all,
  activeStage,
  onStageClick,
}: {
  all: PageCreationSuggestion[];
  activeStage: string | null;
  onStageClick: (key: string | null) => void;
}) {
  const counts: Record<string, number> = {};
  for (const s of all) {
    if (s.status === "skipped" || s.portal_approval === "skipped") continue;
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }

  return (
    <div className="flex items-stretch gap-0 mb-8 rounded-xl border border-slate-200 overflow-hidden bg-white">
      {STAGES.map((stage, i) => {
        const count = counts[stage.key] ?? 0;
        const isActive = activeStage === stage.key;
        return (
          <button
            key={stage.key}
            onClick={() => onStageClick(isActive ? null : stage.key)}
            className={`flex-1 flex flex-col items-center py-4 px-3 border-r border-slate-200 last:border-r-0 transition-colors ${
              isActive ? "bg-slate-50" : "bg-white hover:bg-slate-50/60"
            }`}
          >
            <div className={`text-[22px] font-bold tabular-nums mb-1 ${count > 0 ? stage.color.split(" ")[1] : "text-slate-300"}`}>
              {count}
            </div>
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${count > 0 ? stage.color.split(" ")[1] : "text-slate-300"}`}>
              {stage.label}
            </div>
            {i < STAGES.length - 1 && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">›</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Suggestion card (pending approval) ───────────────────────────────────────

function SuggestionCard({
  s, token, onAction,
}: {
  s: PageCreationSuggestion;
  token: string;
  onAction: (id: string, status: PageCreationStatus) => void;
}) {
  const [loading, setLoading] = useState<"approve" | "skip" | null>(null);
  const isGenerating = s.status === "generating";

  const act = useCallback(async (action: "approve" | "skip") => {
    setLoading(action);
    try {
      await fetch(`/api/portal/page-creation/${s.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      onAction(s.id, action === "skip" ? "skipped" : "generating");
    } finally { setLoading(null); }
  }, [s.id, token, onAction]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_0_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <PageTypePill type={s.page_type} />
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium ring-1 ring-inset ring-slate-200/60">
              {s.target_keyword}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold text-slate-900 leading-snug">{s.page_title}</h3>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{s.suggested_slug}</p>
        </div>
        {fmt(s.proposed_at) && (
          <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{fmt(s.proposed_at)}</span>
        )}
      </div>
      <p className="text-[13px] text-slate-600 leading-[1.65] mb-4">{s.reasoning}</p>
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        {isGenerating ? (
          <p className="text-[13px] text-amber-600 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            Generating content — check back in a few minutes
          </p>
        ) : (
          <>
            <button
              onClick={() => act("approve")}
              disabled={!!loading}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              {loading === "approve" ? "Approving…" : "Approve & Generate Content"}
            </button>
            <button
              onClick={() => act("skip")}
              disabled={!!loading}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              {loading === "skip" ? "Skipping…" : "Skip"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Content-ready card ────────────────────────────────────────────────────────

function ContentReadyCard({
  s, token, companyName, onAction,
}: {
  s: PageCreationSuggestion;
  token: string;
  companyName: string;
  onAction: (id: string, status: PageCreationStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const approve = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/portal/page-creation/${s.id}/approve-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      onAction(s.id, "approved_for_publish");
    } finally { setLoading(false); }
  }, [s.id, token, onAction]);

  return (
    <>
      {previewOpen && (
        <PagePreviewModal
          suggestion={s}
          companyName={companyName}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <div className="bg-white border-2 border-indigo-200 rounded-xl overflow-hidden shadow-[0_2px_8px_0_rgba(99,102,241,0.08)]">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 py-2 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[12px] font-semibold text-indigo-700">Ready for review</span>
            {s.generated_word_count && (
              <span className="text-[11px] text-indigo-400">· {s.generated_word_count.toLocaleString()} words</span>
            )}
          </div>
          <span className="text-[11px] text-indigo-400">{fmt(s.generated_at) ?? ""}</span>
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <PageTypePill type={s.page_type} />
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium ring-1 ring-inset ring-slate-200/60">
                  {s.target_keyword}
                </span>
              </div>
              <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
                {s.generated_h1 || s.page_title}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">{s.suggested_slug}</p>
            </div>
          </div>

          {/* Meta preview row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meta Title</p>
              <p className="text-[13px] text-slate-700 leading-snug">{s.generated_meta_title ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meta Description</p>
              <p className="text-[13px] text-slate-700 leading-snug line-clamp-2">{s.generated_meta_description ?? "—"}</p>
            </div>
          </div>

          {/* Page body teaser */}
          {s.generated_body && (
            <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
              <div
                className="px-5 py-4 max-h-32 overflow-hidden relative"
                style={{ maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)" }}
              >
                <div
                  className="text-[14px] text-slate-600 leading-[1.7] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_p]:mb-3"
                  dangerouslySetInnerHTML={{ __html: s.generated_body }}
                />
              </div>
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Preview as website page
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={approve}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {loading ? "Approving…" : "Approve for Publishing"}
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Preview page
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Done / approved card ──────────────────────────────────────────────────────

function DoneCard({ s, companyName }: { s: PageCreationSuggestion; companyName: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPublished = s.status === "published";

  return (
    <>
      {previewOpen && (
        <PagePreviewModal suggestion={s} companyName={companyName} onClose={() => setPreviewOpen(false)} />
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <PageTypePill type={s.page_type} />
            {isPublished ? (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Published
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-violet-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" /> Pending publish
              </span>
            )}
          </div>
          <p className="text-[14px] font-semibold text-slate-800 leading-snug">
            {s.generated_h1 || s.page_title}
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{s.suggested_slug}</p>
        </div>
        {s.generated_body && (
          <button
            onClick={() => setPreviewOpen(true)}
            className="shrink-0 text-[12px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            Preview
          </button>
        )}
      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-20 flex flex-col items-center text-center">
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
        Page creation suggestions appear after your site audit completes.
      </p>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title, subtitle, count, children, accent = "border-slate-200",
}: {
  title: string; subtitle?: string; count: number; children: React.ReactNode; accent?: string;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-10">
      <div className={`flex items-baseline gap-3 mb-4 pb-3 border-b-2 ${accent}`}>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <span className="text-[12px] font-semibold tabular-nums text-slate-400">{count}</span>
        {subtitle && <span className="text-[12px] text-slate-400">{subtitle}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PageCreationSuggestions({
  items,
  historicalItems,
  token,
  clientPackage,
  companyName = "",
}: {
  items: PageCreationSuggestion[];
  historicalItems: PageCreationSuggestion[];
  token: string;
  clientPackage: string;
  companyName?: string;
}) {
  const limit = suggestionLimit(clientPackage);
  const all = [...items, ...historicalItems];
  const [localAll, setLocalAll] = useState(all);
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const handleAction = useCallback((id: string, newStatus: PageCreationStatus) => {
    setLocalAll(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  }, []);

  const visible = stageFilter
    ? localAll.filter(s => s.status === stageFilter)
    : localAll;

  const contentReady  = visible.filter(s => s.status === "content_ready");
  const suggestions   = visible.filter(s => s.status === "suggested" || s.status === "generating");
  const done          = visible.filter(s => s.status === "approved_for_publish" || s.status === "published");
  const skipped       = visible.filter(s => s.status === "skipped" || s.portal_approval === "skipped");

  if (all.length === 0) return <EmptyState />;

  return (
    <div className="px-10 py-6 max-w-3xl">
      {/* Pipeline summary */}
      <Pipeline all={localAll} activeStage={stageFilter} onStageClick={setStageFilter} />

      {stageFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[12px] text-slate-500">Filtering by stage:</span>
          <button
            onClick={() => setStageFilter(null)}
            className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            Show all ×
          </button>
        </div>
      )}

      {/* Content ready — most prominent */}
      <Section title="Ready for Review" subtitle="review and approve to publish" count={contentReady.length} accent="border-indigo-400">
        {contentReady.map(s => (
          <ContentReadyCard key={s.id} s={s} token={token} companyName={companyName} onAction={handleAction} />
        ))}
      </Section>

      {/* Open suggestions */}
      <Section
        title="Suggestions"
        subtitle={`${Math.min(suggestions.length, limit)} of ${limit} this month`}
        count={suggestions.length}
        accent="border-slate-300"
      >
        {suggestions.map(s => (
          <SuggestionCard key={s.id} s={s} token={token} onAction={handleAction} />
        ))}
      </Section>

      {/* Done */}
      <Section title="Approved & Publishing" count={done.length} accent="border-violet-300">
        {done.map(s => <DoneCard key={s.id} s={s} companyName={companyName} />)}
      </Section>

      {/* Skipped */}
      {skipped.length > 0 && (
        <div className="mb-6">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-300 mb-2">Skipped</p>
          <div className="space-y-1">
            {skipped.map(s => (
              <div key={s.id} className="text-[13px] text-slate-400 py-1 flex items-center justify-between">
                <span>{s.page_title}</span>
                <span className="font-mono text-[11px]">{s.suggested_slug}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
