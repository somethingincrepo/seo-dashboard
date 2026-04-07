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
          <div className="w-[40%] flex items-center justify-center text-slate-400 text-sm">
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
    if (isSelected) leftBorder = "border-l-indigo-500";
    else if (isDecided && approval === "approved") leftBorder = "border-l-emerald-400";
    else if (isDecided && approval === "needs_revision") leftBorder = "border-l-amber-400";

    return (
      <button
        key={result.id}
        onClick={() => {
          setSelectedId(result.id);
          clearFeedback();
        }}
        className={`w-full text-left px-4 py-3 cursor-pointer transition-all duration-150 border-l-2 ${
          isSelected
            ? "border-l-indigo-500 bg-indigo-50/60"
            : `${leftBorder} hover:bg-slate-50 hover:border-l-slate-300`
        }`}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">
            {result.fields["Blog Title"] || "Untitled"}
          </div>
          {result.fields.Slug && (
            <div className="text-xs text-slate-400 mt-0.5 truncate font-mono">
              /{result.fields.Slug}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {result.fields["Content Type"] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {result.fields["Content Type"]}
              </span>
            )}
            {result.fields.Intent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {result.fields.Intent}
              </span>
            )}
            {isDecided && (
              <span
                className={`text-[10px] ${
                  approval === "approved" ? "text-emerald-600" : "text-amber-600"
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
      <div className="w-[40%] flex flex-col min-w-0 border-r border-slate-200 pr-6">
        {/* Tabs */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4">
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
                    ? "bg-white text-slate-900 shadow-[var(--shadow-xs)]"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "pending" ? "Pending Review" : "Decided"}
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "text-slate-500" : "text-slate-400"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {activeTab === "pending" ? "No articles pending review." : "No decisions yet."}
            </div>
          ) : (
            <div className="space-y-1">{activeList.map(renderListItem)}</div>
          )}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="w-[60%] flex flex-col min-w-0 bg-slate-50/40 border-l border-slate-100">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl text-slate-300 mb-2">✦</div>
              <div className="text-sm text-slate-500">Select an article to review</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-8 pb-24">
              {/* Tags */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {selected.fields["Content Type"] && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selected.fields["Content Type"]}
                  </span>
                )}
                {selected.fields.Intent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {selected.fields.Intent}
                  </span>
                )}
                {selected.fields["Target Persona"] && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {selected.fields["Target Persona"]}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                {selected.fields["Blog Title"] || "Untitled"}
              </h2>

              {/* Slug */}
              {selected.fields.Slug && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono mb-5">
                  /{selected.fields.Slug}
                </div>
              )}

              {/* Meta */}
              <div className="space-y-4 mb-6">
                {selected.fields["Meta Title"] && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Meta Title
                    </h3>
                    <p className="text-sm text-slate-700">{selected.fields["Meta Title"]}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selected.fields["Meta Title"].length} chars
                    </p>
                  </div>
                )}
                {selected.fields["Meta Description"] && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      Meta Description
                    </h3>
                    <p className="text-sm text-slate-700">{selected.fields["Meta Description"]}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selected.fields["Meta Description"].length} chars
                    </p>
                  </div>
                )}
              </div>

              {/* Article Body */}
              {selected.fields.Body && (
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                    Article Content
                  </h3>
                  <div
                    className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed [&_h1]:text-slate-900 [&_h2]:text-slate-800 [&_h3]:text-slate-700 [&_a]:text-indigo-600 [&_strong]:text-slate-800"
                    dangerouslySetInnerHTML={{ __html: selected.fields.Body }}
                  />
                </div>
              )}

              {/* Completion date */}
              {formatDate(selected.fields["Created At"]) && (
                <p className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-200">
                  Generated {formatDate(selected.fields["Created At"])}
                </p>
              )}
            </div>

            {/* Sticky action bar */}
            <div className="sticky bottom-0 pt-6 pb-4 px-8 bg-gradient-to-t from-white via-white/95 to-transparent">
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
