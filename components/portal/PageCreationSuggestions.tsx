"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { PageCreationSuggestion, PageCreationStatus } from "@/lib/supabase";
import { PagePreviewPanel } from "./PagePreviewPanel";

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
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset ${cls}`}>
      {type}
    </span>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return null; }
}

// ── Pipeline bar ──────────────────────────────────────────────────────────────

const STAGES = [
  { key: "suggested",            label: "Suggested",       dot: "bg-slate-400" },
  { key: "generating",           label: "Generating",      dot: "bg-amber-400 animate-pulse" },
  { key: "content_ready",        label: "Ready to Review", dot: "bg-indigo-500" },
  { key: "approved_for_publish", label: "Approved",        dot: "bg-violet-500" },
  { key: "published",            label: "Published",       dot: "bg-emerald-500" },
] as const;

type StageKey = typeof STAGES[number]["key"];

function PipelineBar({
  all,
  activeStage,
  onStageClick,
}: {
  all: PageCreationSuggestion[];
  activeStage: StageKey | null;
  onStageClick: (key: StageKey | null) => void;
}) {
  const counts: Partial<Record<StageKey, number>> = {};
  for (const s of all) {
    if (s.status === "skipped" || s.portal_approval === "skipped") continue;
    const st = s.status as StageKey;
    counts[st] = (counts[st] ?? 0) + 1;
  }

  return (
    <div className="flex items-stretch gap-0 rounded-xl border border-slate-200 overflow-hidden bg-white mb-5 shrink-0">
      {STAGES.map((stage, i) => {
        const count = counts[stage.key] ?? 0;
        const isActive = activeStage === stage.key;
        const hasItems = count > 0;
        return (
          <button
            key={stage.key}
            onClick={() => onStageClick(isActive ? null : stage.key)}
            className={`flex-1 flex flex-col items-center py-3 px-2 border-r border-slate-200 last:border-r-0 transition-all cursor-pointer ${
              isActive ? "bg-slate-100" : hasItems ? "hover:bg-slate-50" : "opacity-40 cursor-default"
            }`}
            disabled={!hasItems && !isActive}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasItems ? stage.dot : "bg-slate-200"}`} />
              <span className={`text-[18px] font-bold tabular-nums ${hasItems ? "text-slate-900" : "text-slate-300"}`}>
                {count}
              </span>
            </div>
            <span className={`text-[9px] font-semibold uppercase tracking-wide text-center leading-tight ${
              hasItems ? "text-slate-500" : "text-slate-300"
            }`}>
              {stage.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Compact list item ─────────────────────────────────────────────────────────

const STATUS_BADGES: Partial<Record<PageCreationStatus, { label: string; cls: string }>> = {
  suggested:            { label: "New",        cls: "bg-slate-100 text-slate-500"    },
  generating:           { label: "Generating", cls: "bg-amber-50 text-amber-600"     },
  content_ready:        { label: "Review",     cls: "bg-indigo-50 text-indigo-600"   },
  approved_for_publish: { label: "Approved",   cls: "bg-violet-50 text-violet-600"   },
  published:            { label: "Live",        cls: "bg-emerald-50 text-emerald-600" },
  skipped:              { label: "Skipped",    cls: "bg-slate-50 text-slate-400"     },
  failed:               { label: "Failed",     cls: "bg-red-50 text-red-500"         },
};

function ListItem({
  s,
  isSelected,
  onClick,
}: {
  s: PageCreationSuggestion;
  isSelected: boolean;
  onClick: () => void;
}) {
  const badge = STATUS_BADGES[s.status as PageCreationStatus];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg px-3 py-3 border transition-all ${
        isSelected
          ? "border-indigo-300 bg-indigo-50/60 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <PageTypePill type={s.page_type} />
        </div>
        {badge && (
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </div>
      <p className={`text-[13px] font-semibold leading-snug mb-0.5 ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>
        {s.generated_h1 || s.page_title}
      </p>
      <p className="text-[10px] font-mono text-slate-400 truncate">{s.suggested_slug}</p>
      {s.target_keyword && (
        <p className="text-[11px] text-slate-400 mt-1 truncate">{s.target_keyword}</p>
      )}
    </button>
  );
}

// ── Suggestion action pane (bottom of left col when suggested is selected) ────

function SuggestionActions({
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
    } finally { setLoading(null); }
  }, [s.id, token, onAction]);

  if (s.status === "generating") {
    return (
      <div className="px-3 py-3 rounded-lg bg-amber-50 border border-amber-200 mt-3 text-[12px] text-amber-700 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        Generating content — check back shortly.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-slate-500 leading-relaxed">{s.reasoning}</p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => act("approve")}
          disabled={!!loading}
          className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          {loading === "approve" ? "Approving…" : "Approve & Generate"}
        </button>
        <button
          onClick={() => act("skip")}
          disabled={!!loading}
          className="py-2 px-3 rounded-lg text-[12px] font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </div>
      <h3 className="text-[14px] font-semibold text-slate-700 mb-1">No suggestions yet</h3>
      <p className="text-[12px] text-slate-400 max-w-[200px]">Suggestions appear after your audit completes.</p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

// ── CMS publishing guide ──────────────────────────────────────────────────────

type CmsGuideStep = { done: boolean; title: string; desc: React.ReactNode };

function GuideStep({ done, title, desc }: CmsGuideStep) {
  return (
    <div className="flex gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 ${
        done ? "bg-emerald-100 text-emerald-700" : "bg-white border border-slate-300 text-slate-400"
      }`}>{done ? "✓" : "·"}</div>
      <div className="flex-1 min-w-0 pb-3 border-b border-slate-100 last:border-0">
        <p className={`text-[13px] font-semibold leading-tight ${done ? "text-emerald-700" : "text-slate-800"}`}>{title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function CmsPublishingGuide({
  cms,
  slug,
  isPublished,
}: {
  cms: string;
  slug: string;
  isPublished: boolean;
}) {
  const slugChip = (
    <span className="font-mono text-[11px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
      {slug}
    </span>
  );

  let cmsLabel = "your CMS";
  let steps: CmsGuideStep[] = [];

  if (cms === "wordpress") {
    cmsLabel = "WordPress";
    steps = [
      { done: true,       title: "Content approved",            desc: "Full page content is ready — H1, body, FAQs, and meta fields." },
      { done: isPublished, title: "Page created in WordPress",  desc: <>We create a new page at {slugChip}, paste the generated content, and configure title + meta via Yoast or RankMath. No action needed from you.</> },
      { done: isPublished, title: "Internal links added",       desc: "We insert links to this new page from your most relevant existing pages so it gets crawl authority immediately." },
      { done: isPublished, title: "Goes live",                  desc: "The page is published in WordPress and updates here to 'Live'." },
      { done: false,       title: "Indexed by Google",          desc: "We submit the URL to Google Search Console for fast crawling. Expect search visibility within 2–4 weeks." },
    ];
  } else if (cms === "shopify") {
    cmsLabel = "Shopify";
    steps = [
      { done: true,        title: "Content approved",           desc: "Full page content is ready." },
      { done: isPublished, title: "Page created in Shopify",   desc: <>Go to <strong>Online Store → Pages → Add page</strong>. Set the title to the H1 shown in the preview. Set the URL handle to {slugChip}.</> },
      { done: isPublished, title: "Paste the content",         desc: "Copy the body from the preview and paste it into the Shopify page editor. Set the SEO meta title and description from the meta strip." },
      { done: isPublished, title: "Publish the page",          desc: "Save and set visibility to 'Visible'. Let us know once it's live so we can add internal links." },
      { done: false,       title: "Indexed by Google",         desc: "We'll submit the URL to Search Console once the page is live." },
    ];
  } else if (cms === "webflow") {
    cmsLabel = "Webflow";
    steps = [
      { done: true,        title: "Content approved",           desc: "Full page content is ready." },
      { done: isPublished, title: "Page created in Webflow",   desc: <>In the Webflow Designer, add a new static page and set its slug to {slugChip}. Or we can create it directly if your project is connected.</> },
      { done: isPublished, title: "Content pasted in",         desc: "Add a Rich Text element and paste the body content. Set the page title and meta description in the page SEO settings." },
      { done: isPublished, title: "Published",                 desc: "Publish the Webflow project to push the new page live. Let us know once done." },
      { done: false,       title: "Indexed by Google",         desc: "We'll submit to Search Console after publishing." },
    ];
  } else if (cms === "hubspot") {
    cmsLabel = "HubSpot";
    steps = [
      { done: true,        title: "Content approved",           desc: "Full page content is ready." },
      { done: isPublished, title: "Page created in HubSpot",   desc: <>In HubSpot, go to <strong>Marketing → Website → Website Pages</strong> and create a new page. Set the URL to {slugChip}.</> },
      { done: isPublished, title: "Content added",             desc: "Add the body content via the drag-and-drop editor or HTML module. Set the meta title and description in the page settings." },
      { done: isPublished, title: "Published",                 desc: "Publish the page and share the live URL so we can add internal links." },
      { done: false,       title: "Indexed by Google",         desc: "Submitted to Search Console after publishing." },
    ];
  } else {
    cmsLabel = "your site";
    steps = [
      { done: true,        title: "Content approved",           desc: "Full page content is ready — you can copy it from the preview." },
      { done: isPublished, title: "Page created manually",     desc: <>Create a new page on your site at {slugChip}. Paste in the H1, body copy, and FAQ section from the preview.</> },
      { done: isPublished, title: "SEO fields set",            desc: "Add the meta title and description (shown in the meta strip at the top of the preview) to your page's SEO settings." },
      { done: isPublished, title: "Goes live",                 desc: "Once published, let us know so we can add internal links and submit to Search Console." },
      { done: false,       title: "Indexed by Google",         desc: "We'll request indexing via Search Console to speed up discovery." },
    ];
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 shrink-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
        How it gets published · {cmsLabel}
      </p>
      <div className="space-y-0">
        {steps.map((s, i) => <GuideStep key={i} {...s} />)}
      </div>
    </div>
  );
}

export function PageCreationSuggestions({
  items,
  historicalItems,
  token,
  clientPackage,
  companyName = "",
  cms = "",
}: {
  items: PageCreationSuggestion[];
  historicalItems: PageCreationSuggestion[];
  token: string;
  clientPackage: string;
  companyName?: string;
  cms?: string;
}) {
  const all = [...items, ...historicalItems];
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");
  const [localAll, setLocalAll] = useState(all);
  const [stageFilter, setStageFilter] = useState<StageKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    urlId && all.some(s => s.id === urlId) ? urlId : null
  );
  const [approving, setApproving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Auto-select: URL param first, then content_ready, then first non-skipped
  useEffect(() => {
    if (!selectedId) {
      const ready = localAll.find(s => s.status === "content_ready");
      const first = localAll.find(s => s.status !== "skipped" && s.portal_approval !== "skipped");
      setSelectedId(ready?.id ?? first?.id ?? null);
    }
  }, [localAll, selectedId]);

  const handleAction = useCallback((id: string, newStatus: PageCreationStatus) => {
    setLocalAll(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    // Re-auto-select if needed
    if (newStatus === "generating" || newStatus === "skipped") {
      setSelectedId(null); // triggers re-auto-select via useEffect
    }
  }, []);

  const handleApproveContent = useCallback(async () => {
    if (!selectedId) return;
    setApproving(true);
    try {
      await fetch(`/api/portal/page-creation/${selectedId}/approve-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      handleAction(selectedId, "approved_for_publish");
    } finally { setApproving(false); }
  }, [selectedId, token, handleAction]);

  const handleApproveSuggestion = useCallback(async () => {
    if (!selectedId) return;
    setApproving(true);
    try {
      await fetch(`/api/portal/page-creation/${selectedId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      handleAction(selectedId, "generating");
    } finally { setApproving(false); }
  }, [selectedId, token, handleAction]);

  const handleSkipSuggestion = useCallback(async () => {
    if (!selectedId) return;
    await fetch(`/api/portal/page-creation/${selectedId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    handleAction(selectedId, "skipped");
  }, [selectedId, token, handleAction]);

  const visible = stageFilter
    ? localAll.filter(s => s.status === stageFilter)
    : localAll.filter(s => s.status !== "skipped" && s.portal_approval !== "skipped");

  const selectedSuggestion = localAll.find(s => s.id === selectedId) ?? null;

  if (localAll.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline bar */}
      <PipelineBar
        all={localAll}
        activeStage={stageFilter}
        onStageClick={(key) => {
          setStageFilter(key);
          // Auto-select first item in filtered stage
          if (key) {
            const first = localAll.find(s => s.status === key);
            if (first) setSelectedId(first.id);
          }
        }}
      />

      {/* Split pane */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left: item list */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          {stageFilter && (
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {STAGES.find(s => s.key === stageFilter)?.label}
              </span>
              <button
                onClick={() => setStageFilter(null)}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Show all ×
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {visible.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">Nothing here.</p>
            ) : (
              visible.map(s => (
                <ListItem
                  key={s.id}
                  s={s}
                  isSelected={selectedId === s.id}
                  onClick={() => setSelectedId(s.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: page preview */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm flex flex-col">
          {/* Browser chrome */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 border-b border-slate-200 shrink-0">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <div className="flex-1 bg-white rounded px-3 py-1 text-[11px] font-mono text-slate-500 border border-slate-200 truncate">
              {selectedSuggestion?.suggested_slug ?? "—"}
            </div>
          </div>

          {/* ── Fixed action bar (content_ready) ── */}
          {selectedSuggestion?.status === "content_ready" && (
            <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border-b border-indigo-100 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-indigo-900 leading-tight">Ready for your approval</p>
                <p className="text-[11px] text-indigo-500 mt-0.5">Review the page below, then approve when happy.</p>
              </div>
              <button
                onClick={() => setGuideOpen(v => !v)}
                className="text-[12px] font-medium text-indigo-500 hover:text-indigo-700 whitespace-nowrap shrink-0"
              >
                {guideOpen ? "Hide guide ↑" : "How it gets published →"}
              </button>
              <button
                onClick={handleApproveContent}
                disabled={approving}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
              >
                {approving ? "Approving…" : "Approve for Publishing"}
              </button>
            </div>
          )}

          {/* ── Fixed action bar (approved / published) ── */}
          {(selectedSuggestion?.status === "approved_for_publish" || selectedSuggestion?.status === "published") && (
            <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 border-b border-emerald-100 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-[13px] font-semibold text-emerald-800 flex-1">
                {selectedSuggestion.status === "published" ? "Published" : "Approved — pending publish"}
              </p>
              <button
                onClick={() => setGuideOpen(v => !v)}
                className="text-[12px] font-medium text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
              >
                {guideOpen ? "Hide guide ↑" : "Publishing guide →"}
              </button>
            </div>
          )}

          {/* ── Publishing guide (expandable, fixed above preview) ── */}
          {guideOpen && selectedSuggestion && (
            selectedSuggestion.status === "content_ready" ||
            selectedSuggestion.status === "approved_for_publish" ||
            selectedSuggestion.status === "published"
          ) && (
            <div className="overflow-y-auto max-h-72 shrink-0">
              <CmsPublishingGuide
                cms={cms}
                slug={selectedSuggestion!.suggested_slug}
                isPublished={selectedSuggestion!.status === "published"}
              />
            </div>
          )}

          {/* Scrollable page preview */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <PagePreviewPanel
              suggestion={selectedSuggestion}
              companyName={companyName}
              onApproveSuggestion={selectedSuggestion?.status === "suggested" ? handleApproveSuggestion : undefined}
              onSkipSuggestion={selectedSuggestion?.status === "suggested" ? handleSkipSuggestion : undefined}
              approving={approving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
