"use client";

import { useState, useCallback } from "react";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { PageCreationSuggestion, PageCreationStatus } from "@/lib/supabase";

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

function pageTypePill(type: string) {
  const cls = PAGE_TYPE_COLORS[type] ?? "bg-slate-100 text-slate-600 ring-slate-200/60";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${cls}`}>
      {type}
    </span>
  );
}

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return null; }
}

// ── Shared card header ────────────────────────────────────────────────────────

function CardHeader({ s }: { s: PageCreationSuggestion }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {pageTypePill(s.page_type)}
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
  );
}

// ── Suggestion card (pending approval) ───────────────────────────────────────

function SuggestionCard({
  s,
  token,
  onAction,
}: {
  s: PageCreationSuggestion;
  token: string;
  onAction: (id: string, status: PageCreationStatus) => void;
}) {
  const [loading, setLoading] = useState<"approve" | "skip" | null>(null);

  const act = useCallback(async (action: "approve" | "skip") => {
    setLoading(action);
    try {
      await fetch(`/api/portal/page-creation/${s.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      onAction(s.id, action === "skip" ? "skipped" : "generating");
    } finally {
      setLoading(null);
    }
  }, [s.id, token, onAction]);

  const isGenerating = s.status === "generating";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_0_rgba(16,24,40,0.04)]">
      <CardHeader s={s} />
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

// ── Content-ready card (full content review) ──────────────────────────────────

function ContentReadyCard({
  s,
  token,
  onAction,
}: {
  s: PageCreationSuggestion;
  token: string;
  onAction: (id: string, status: PageCreationStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  const approve = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/portal/page-creation/${s.id}/approve-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      onAction(s.id, "approved_for_publish");
    } finally {
      setLoading(false);
    }
  }, [s.id, token, onAction]);

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-xl overflow-hidden shadow-[0_2px_8px_0_rgba(99,102,241,0.08)]">
      {/* Top bar */}
      <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        <span className="text-[12px] font-semibold text-indigo-700">Content ready for review</span>
        {s.generated_word_count && (
          <span className="ml-auto text-[11px] text-indigo-400">{s.generated_word_count.toLocaleString()} words</span>
        )}
      </div>

      <div className="p-5">
        <CardHeader s={s} />

        {/* Meta fields */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meta Title</p>
            <p className="text-[13px] text-slate-800 leading-snug">{s.generated_meta_title ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meta Description</p>
            <p className="text-[13px] text-slate-800 leading-snug">{s.generated_meta_description ?? "—"}</p>
          </div>
        </div>

        {/* H1 */}
        {s.generated_h1 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">H1</p>
            <p className="text-[15px] font-semibold text-slate-900">{s.generated_h1}</p>
          </div>
        )}

        {/* Page body */}
        {s.generated_body && (
          <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Page Body</span>
              <button
                onClick={() => setBodyExpanded(v => !v)}
                className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                {bodyExpanded ? "Collapse" : "Read full page"}
              </button>
            </div>
            <div
              className={`px-6 py-4 overflow-y-auto transition-all duration-200 ${bodyExpanded ? "max-h-[700px]" : "max-h-40"}`}
              style={{ maskImage: bodyExpanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)" }}
            >
              <div
                className="text-[14px] text-slate-700 leading-[1.75] [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-6 [&_h2]:mb-2.5 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-slate-200 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-3.5 [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_li]:text-[14px] [&_li]:leading-[1.65] [&_strong]:font-semibold [&_strong]:text-slate-900"
                dangerouslySetInnerHTML={{ __html: s.generated_body }}
              />
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
        </div>
      </div>
    </div>
  );
}

// ── Done card (approved / published) ─────────────────────────────────────────

function DoneCard({ s }: { s: PageCreationSuggestion }) {
  const statusLabel = s.status === "published" ? "Published" : "Approved for publishing";
  const statusColor = s.status === "published" ? "text-emerald-600" : "text-violet-600";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 opacity-70">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {pageTypePill(s.page_type)}
          </div>
          <p className="text-[14px] font-medium text-slate-700 leading-snug">{s.page_title}</p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{s.suggested_slug}</p>
        </div>
        <span className={`text-[12px] font-semibold shrink-0 ${statusColor}`}>{statusLabel}</span>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  count,
  children,
  accent = "border-slate-200",
}: {
  title: string;
  subtitle?: string;
  count: number;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="mb-10">
      <div className={`flex items-baseline gap-3 mb-4 pb-3 border-b-2 ${accent}`}>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <span className="text-[12px] font-semibold tabular-nums text-slate-400">{count}</span>
        {subtitle && <span className="text-[12px] text-slate-400 ml-1">{subtitle}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
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
  const all = [...items, ...historicalItems];

  const [localAll, setLocalAll] = useState(all);

  const handleAction = useCallback((id: string, newStatus: PageCreationStatus) => {
    setLocalAll(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  }, []);

  const contentReady = localAll.filter(s => s.status === "content_ready");
  const suggestions  = localAll.filter(s => s.status === "suggested" || s.status === "generating");
  const done         = localAll.filter(s => s.status === "approved_for_publish" || s.status === "published");
  const skipped      = localAll.filter(s => s.status === "skipped" || s.portal_approval === "skipped");

  const hasAnything = localAll.length > 0;

  if (!hasAnything) return <EmptyState />;

  return (
    <div className="px-10 py-6 max-w-3xl">
      {/* Content ready — most prominent, shown first */}
      {contentReady.length > 0 && (
        <Section
          title="Ready for Your Review"
          subtitle="Review the generated page and approve to publish"
          count={contentReady.length}
          accent="border-indigo-400"
        >
          {contentReady.map(s => (
            <ContentReadyCard key={s.id} s={s} token={token} onAction={handleAction} />
          ))}
        </Section>
      )}

      {/* Open suggestions */}
      {suggestions.length > 0 && (
        <Section
          title="Suggestions"
          subtitle={`${suggestions.length} of ${limit} this month — approve to generate a full page`}
          count={suggestions.length}
          accent="border-slate-300"
        >
          {suggestions.map(s => (
            <SuggestionCard key={s.id} s={s} token={token} onAction={handleAction} />
          ))}
        </Section>
      )}

      {/* Done */}
      {done.length > 0 && (
        <Section title="Approved & Publishing" count={done.length} accent="border-emerald-300">
          {done.map(s => <DoneCard key={s.id} s={s} />)}
        </Section>
      )}

      {/* Skipped — shown last, very quiet */}
      {skipped.length > 0 && (
        <Section title="Skipped" count={skipped.length} accent="border-slate-100">
          {skipped.map(s => (
            <div key={s.id} className="text-[13px] text-slate-400 py-1.5 border-b border-slate-100 last:border-0 flex items-center justify-between">
              <span>{s.page_title}</span>
              <span className="font-mono text-[11px]">{s.suggested_slug}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
