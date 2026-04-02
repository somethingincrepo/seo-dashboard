"use client";

import { useState, useCallback, Suspense } from "react";
import { useArticleActions } from "./useArticleActions";
import { ArticleActionBar } from "./ArticleActionBar";
import type { ContentResult } from "@/lib/content";

interface ArticleMasterDetailProps {
  results: ContentResult[];
  token: string;
}

export function ArticleMasterDetail(props: ArticleMasterDetailProps) {
  return (
    <Suspense
      fallback={
        <div className="flex gap-0 h-[calc(100vh-20rem)]">
          <div className="w-[40%] flex items-center justify-center text-white/30 text-sm">
            Loading...
          </div>
          <div className="w-[60%]" />
        </div>
      }
    >
      <ArticleMasterDetailInner {...props} />
    </Suspense>
  );
}

function ArticleMasterDetailInner({ results, token }: ArticleMasterDetailProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "decided">("pending");
  const [localDecisions, setLocalDecisions] = useState<Map<string, string>>(new Map());

  const onDecisionApplied = useCallback((resultId: string, decision: string) => {
    setLocalDecisions((prev) => {
      const next = new Map(prev);
      next.set(resultId, decision);
      return next;
    });
  }, []);

  const { submitting, feedback, error, clearFeedback, applyDecision } = useArticleActions({
    token,
    onDecisionApplied,
  });

  const getEffectiveApproval = (result: ContentResult): string | null => {
    return localDecisions.get(result.id) ?? result.fields.portal_approval ?? null;
  };

  const pending = results.filter((r) => {
    const approval = getEffectiveApproval(r);
    return !approval || approval === null;
  });

  const decided = results.filter((r) => {
    const approval = getEffectiveApproval(r);
    return approval === "approved" || approval === "needs_revision";
  });

  const activeList = activeTab === "pending" ? pending : decided;
  const selected = selectedId ? results.find((r) => r.id === selectedId) : null;

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return null;
    }
  };

  const renderListItem = (result: ContentResult) => {
    const approval = getEffectiveApproval(result);
    const isSelected = selectedId === result.id;
    const isDecided = approval === "approved" || approval === "needs_revision";

    let leftBorder = "border-l-transparent";
    if (isSelected) leftBorder = "border-l-violet-400";
    else if (isDecided && approval === "approved") leftBorder = "border-l-emerald-400/40";
    else if (isDecided && approval === "needs_revision") leftBorder = "border-l-amber-400/40";

    return (
      <button
        key={result.id}
        onClick={() => {
          setSelectedId(result.id);
          clearFeedback();
        }}
        className={`w-full text-left px-4 py-3 cursor-pointer transition-all duration-150 border-l-2 ${
          isSelected
            ? "border-l-violet-400 bg-white/[0.06]"
            : `${leftBorder} hover:bg-white/[0.04] hover:border-l-white/10`
        }`}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/80 truncate">
            {result.fields["Blog Title"] || "Untitled"}
          </div>
          {result.fields.Slug && (
            <div className="text-xs text-white/30 mt-0.5 truncate font-mono">
              /{result.fields.Slug}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {result.fields["Content Type"] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-400/20">
                {result.fields["Content Type"]}
              </span>
            )}
            {result.fields.Intent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-400/15">
                {result.fields.Intent}
              </span>
            )}
            {isDecided && (
              <span
                className={`text-[10px] ${
                  approval === "approved" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {approval === "approved" ? "✓ Approved" : "↩ Revision requested"}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-20rem)] min-h-[400px]">
      {/* ── Left Panel ── */}
      <div className="w-[40%] flex flex-col min-w-0 border-r border-white/[0.06] pr-6">
        {/* Tabs */}
        <div className="inline-flex rounded-xl bg-white/[0.04] p-1 mb-4">
          {(["pending", "decided"] as const).map((tab) => {
            const count = tab === "pending" ? pending.length : decided.length;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedId(null);
                  clearFeedback();
                }}
                className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeTab === tab
                    ? "bg-white/[0.08] text-white/90 shadow-sm"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {tab === "pending" ? "Pending Review" : "Decided"}
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "text-white/50" : "text-white/30"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeList.length === 0 ? (
            <div className="py-12 text-center text-white/30 text-sm">
              {activeTab === "pending" ? "No articles pending review." : "No decisions yet."}
            </div>
          ) : (
            <div className="space-y-1">{activeList.map(renderListItem)}</div>
          )}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="w-[60%] flex flex-col min-w-0 bg-white/[0.03] border-l border-white/[0.06]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl text-white/10 mb-2">✦</div>
              <div className="text-sm text-white/20">Select an article to review</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-8 pb-24">
              {/* Tags */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {selected.fields["Content Type"] && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-400/20">
                    {selected.fields["Content Type"]}
                  </span>
                )}
                {selected.fields.Intent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-400/15">
                    {selected.fields.Intent}
                  </span>
                )}
                {selected.fields["Target Persona"] && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.08]">
                    {selected.fields["Target Persona"]}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold text-white/90 mb-2">
                {selected.fields["Blog Title"] || "Untitled"}
              </h2>

              {/* Slug */}
              {selected.fields.Slug && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-400/15 text-violet-300 text-xs font-mono mb-5">
                  /{selected.fields.Slug}
                </div>
              )}

              {/* Meta */}
              <div className="space-y-4 mb-6">
                {selected.fields["Meta Title"] && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-1.5">
                      Meta Title
                    </h3>
                    <p className="text-sm text-white/70">{selected.fields["Meta Title"]}</p>
                    <p className="text-[11px] text-white/25 mt-0.5">
                      {selected.fields["Meta Title"].length} chars
                    </p>
                  </div>
                )}
                {selected.fields["Meta Description"] && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-1.5">
                      Meta Description
                    </h3>
                    <p className="text-sm text-white/70">{selected.fields["Meta Description"]}</p>
                    <p className="text-[11px] text-white/25 mt-0.5">
                      {selected.fields["Meta Description"].length} chars
                    </p>
                  </div>
                )}
              </div>

              {/* Article Body */}
              {selected.fields.Body && (
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
                    Article Content
                  </h3>
                  <div
                    className="prose prose-invert prose-sm max-w-none text-white/70 leading-relaxed [&_h1]:text-white/80 [&_h2]:text-white/75 [&_h3]:text-white/70 [&_a]:text-violet-400 [&_strong]:text-white/80"
                    dangerouslySetInnerHTML={{ __html: selected.fields.Body }}
                  />
                </div>
              )}

              {/* Completion date */}
              {formatDate(selected.fields["Created At"]) && (
                <p className="text-xs text-white/20 mt-6 pt-4 border-t border-white/[0.06]">
                  Generated {formatDate(selected.fields["Created At"])}
                </p>
              )}
            </div>

            {/* Sticky action bar */}
            <div className="sticky bottom-0 pt-6 pb-4 px-8 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/95 to-transparent">
              <ArticleActionBar
                resultId={selected.id}
                portalApproval={getEffectiveApproval(selected)}
                submitting={submitting}
                feedback={feedback}
                error={error}
                onApprove={() =>
                  applyDecision(selected.id, "approved", selected.fields["Blog Title"])
                }
                onRequestRevision={(notes) =>
                  applyDecision(selected.id, "needs_revision", selected.fields["Blog Title"], notes)
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
