"use client";

import { useState, useCallback } from "react";
import { bracketToHtml } from "@/lib/bracketToHtml";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { ContentJob, ContentResult } from "@/lib/content";

// ── Types ─────────────────────────────────────────────────────────────────────

type RefreshItem = {
  job: ContentJob;
  result: ContentResult | null;
};

// ── Package allocation helper ─────────────────────────────────────────────────

function refreshLimit(pkg: string): number {
  return PACKAGES[(pkg as PackageTier) in PACKAGES ? (pkg as PackageTier) : "starter"].content_refreshes;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getItemStatus(item: RefreshItem): "review" | "running" | "approved" | "proposed" {
  const ts = item.job.fields.title_status;
  const approval = item.result?.fields.portal_approval;
  if (ts === "completed" && !approval) return "review";
  if (ts === "approved" && !item.result) return "running";
  if (ts === "completed" && approval === "approved") return "approved";
  return "proposed";
}

const STATUS_CONFIG = {
  review:   { label: "Ready for Review", dot: "bg-indigo-400", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200/60" },
  running:  { label: "Update in Progress", dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 ring-amber-200/60" },
  approved: { label: "Approved",          dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
  proposed: { label: "Scheduled",         dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500 ring-slate-200/60" },
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  "Blog Post":    "bg-blue-50 text-blue-700",
  "Service Page": "bg-violet-50 text-violet-700",
  "Landing Page": "bg-emerald-50 text-emerald-700",
  "Other":        "bg-slate-100 text-slate-600",
};

// ── Derive original body from article body ────────────────────────────────────
// Reconstructs "before" state by substituting [CHANGED from="old"] back and
// removing [ADDED] blocks entirely. Renders perfectly aligned with right panel.

function deriveOriginalBody(body: string): string {
  return body
    // [CHANGED from="old text"]new text[/CHANGED] → "old text"
    .replace(/\[CHANGED from="([^"]*)"\][\s\S]*?\[\/CHANGED\]/g, "$1")
    // [ADDED]...[/ADDED] → remove entirely (these didn't exist before)
    .replace(/\[ADDED\][\s\S]*?\[\/ADDED\]/g, "")
    // [REMOVED]...[/REMOVED] → keep the content (it was there before)
    .replace(/\[REMOVED\]([\s\S]*?)\[\/REMOVED\]/g, "$1");
}

// Strip bracket markup to count words
function countWords(body: string): number {
  return body.replace(/\[\/?\w+[^\]]*\]/g, " ").split(/\s+/).filter((w) => w.length > 1).length;
}

// Extract the new (proposed) value from a meta field — strips change markers
function cleanMetaText(text: string): string {
  return text
    .replace(/\[CHANGED from="[^"]*"\]([\s\S]*?)\[\/CHANGED\]/g, "$1")
    .replace(/\[ADDED\]([\s\S]*?)\[\/ADDED\]/g, "$1")
    .replace(/\[REMOVED\][\s\S]*?\[\/REMOVED\]/g, "")
    .replace(/\[\/?\w+[^\]]*\]/g, "")
    .trim();
}

// Extract the original (before) value from a meta field
function originalMetaText(text: string): string {
  const match = text.match(/\[CHANGED from="([^"]*)"\]/);
  if (match) return match[1].trim();
  return cleanMetaText(text); // unchanged — original = new
}

// Whether a meta field has a change (so we can show an "Edited" indicator)
function metaWasChanged(text: string): boolean {
  return /\[CHANGED from="[^"]*"\]/.test(text);
}

// Inline change-marker CSS shared between meta boxes and body
const CT_INLINE = [
  "[&_.ct-changed]:inline [&_.ct-changed]:rounded-sm [&_.ct-changed]:bg-amber-50 [&_.ct-changed]:px-0.5 [&_.ct-changed]:ring-1 [&_.ct-changed]:ring-amber-300/60",
  "[&_.ct-del]:line-through [&_.ct-del]:text-red-500 [&_.ct-del]:mr-1.5 [&_.ct-del]:bg-red-100 [&_.ct-del]:px-0.5 [&_.ct-del]:rounded-sm",
  "[&_.ct-ins]:text-emerald-800 [&_.ct-ins]:bg-emerald-100 [&_.ct-ins]:px-0.5 [&_.ct-ins]:rounded-sm [&_.ct-ins]:font-semibold",
].join(" ");

// Shared prose CSS applied to both left and right panels
const PROSE_CLASSES = `
  text-[13px] text-slate-700 leading-relaxed
  [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-slate-200
  [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-slate-100
  [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-1.5
  [&_p]:mb-3 [&_p]:leading-relaxed
  [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1
  [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1
  [&_li]:text-[13px]
  [&_strong]:font-semibold [&_strong]:text-slate-900
`.trim().replace(/\s+/g, " ");

// ── How it works strip ────────────────────────────────────────────────────────

function HowItWorks({ status }: { status: ReturnType<typeof getItemStatus> }) {
  const steps = [
    {
      label: "Opportunity identified",
      desc: "We scanned your site and flagged this page for improvement based on keyword gaps and content quality",
      done: true,
    },
    {
      label: "Page updated",
      desc: "We adjusted headings, added missing sections, and aligned the content with target keywords",
      done: status === "review" || status === "approved",
    },
    {
      label: "Published to site",
      desc: "Once you approve, the refreshed version replaces the existing page on your live site",
      done: status === "approved",
    },
  ];

  return (
    <div className="border border-slate-200 rounded-xl px-5 py-4 mb-5">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
        How this works
      </div>
      <div className="flex gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-start gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                  step.done
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-300 text-slate-400"
                }`}
              >
                {step.done ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-px flex-1 mt-1 mb-1 min-h-[16px] ${step.done ? "bg-slate-700" : "bg-slate-200"}`} />
              )}
            </div>
            <div className="ml-3 pb-4 min-w-0 flex-1 pr-4">
              <div className="text-[12px] font-semibold text-slate-800 leading-tight">{step.label}</div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Original page panel (derived from article body) ───────────────────────────

function OriginalPanel({
  body,
  rawMetaTitle,
  rawMetaDesc,
}: {
  body: string;
  rawMetaTitle: string;
  rawMetaDesc: string;
}) {
  const originalBody = deriveOriginalBody(body);
  const html = bracketToHtml(originalBody);
  const origTitle = originalMetaText(rawMetaTitle);
  const origDesc = originalMetaText(rawMetaDesc);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {/* Meta fields — original values */}
      {(origTitle || origDesc) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-5 space-y-1.5">
          {origTitle && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-slate-400">Meta title</span>
                <span className={origTitle.length > 60 ? "text-red-500 font-bold" : "text-slate-400"}>
                  ({origTitle.length}/60)
                </span>
                {metaWasChanged(rawMetaTitle) && (
                  <span className="text-amber-600 normal-case font-medium">current</span>
                )}
              </div>
              <p className="text-[12px] text-slate-700 font-medium mt-0.5">{origTitle}</p>
            </div>
          )}
          {origDesc && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-slate-400">Meta description</span>
                <span className={origDesc.length > 155 ? "text-red-500 font-bold" : "text-slate-400"}>
                  ({origDesc.length}/155)
                </span>
                {metaWasChanged(rawMetaDesc) && (
                  <span className="text-amber-600 normal-case font-medium">current</span>
                )}
              </div>
              <p className="text-[12px] text-slate-600 italic mt-0.5">{origDesc}</p>
            </div>
          )}
        </div>
      )}

      <div
        className={PROSE_CLASSES}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Refreshed content panel ───────────────────────────────────────────────────

function RefreshedPanel({
  result,
  origWordCount,
}: {
  result: ContentResult;
  origWordCount: number;
}) {
  const body = result.fields["Article body"] ?? "";
  const html = bracketToHtml(body);
  const wordCount = countWords(body);
  const rawMetaTitle = result.fields["Meta title"] ?? "";
  const rawMetaDesc  = result.fields["Meta description"] ?? "";
  const newMetaTitle = cleanMetaText(rawMetaTitle);
  const newMetaDesc  = cleanMetaText(rawMetaDesc);

  const delta = wordCount - origWordCount;
  const deltaLabel = delta > 0
    ? `+${delta.toLocaleString()} vs. current`
    : delta < 0
      ? `${delta.toLocaleString()} vs. current`
      : "same length as current";
  const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400";

  const hasChangeMarkers = /\[ADDED\]|\[CHANGED |\[REMOVED\]/.test(body);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {/* Stats + legend */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            ~{wordCount.toLocaleString()} words
          </span>
          <span className={`text-[10px] font-semibold ${deltaColor}`}>
            ({deltaLabel})
          </span>
        </div>
        {hasChangeMarkers && (
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-400" />
              <span className="text-[10px] text-slate-500">Added</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-400" />
              <span className="text-[10px] text-slate-500">Edited</span>
            </div>
          </div>
        )}
      </div>

      {/* Meta fields — render through bracketToHtml so [CHANGED] shows del/ins */}
      {(rawMetaTitle || rawMetaDesc) && (
        <div className={`bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-5 space-y-1.5 ${CT_INLINE}`}>
          {rawMetaTitle && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-slate-400">Meta title</span>
                <span className={newMetaTitle.length > 60 ? "text-red-500 font-bold" : "text-slate-400"}>
                  ({newMetaTitle.length}/60)
                </span>
                {metaWasChanged(rawMetaTitle) && (
                  <span className="text-amber-600 normal-case font-medium">proposed</span>
                )}
              </div>
              <div
                className="text-[12px] text-slate-700 font-medium mt-0.5"
                dangerouslySetInnerHTML={{ __html: bracketToHtml(rawMetaTitle) }}
              />
            </div>
          )}
          {rawMetaDesc && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-slate-400">Meta description</span>
                <span className={newMetaDesc.length > 155 ? "text-red-500 font-bold" : "text-slate-400"}>
                  ({newMetaDesc.length}/155)
                </span>
                {metaWasChanged(rawMetaDesc) && (
                  <span className="text-amber-600 normal-case font-medium">proposed</span>
                )}
              </div>
              <div
                className="text-[12px] text-slate-600 italic mt-0.5"
                dangerouslySetInnerHTML={{ __html: bracketToHtml(rawMetaDesc) }}
              />
            </div>
          )}
        </div>
      )}

      {/* Article body with change markers */}
      <div
        className={`
          ${PROSE_CLASSES}
          [&_.ct-added]:block [&_.ct-added]:bg-emerald-50 [&_.ct-added]:border-l-[3px] [&_.ct-added]:border-emerald-500 [&_.ct-added]:pl-3 [&_.ct-added]:my-4 [&_.ct-added]:rounded-r-md [&_.ct-added]:py-1
          [&_.ct-label]:inline-block [&_.ct-label]:text-[9px] [&_.ct-label]:font-bold [&_.ct-label]:uppercase [&_.ct-label]:tracking-widest [&_.ct-label]:px-1.5 [&_.ct-label]:py-0.5 [&_.ct-label]:rounded [&_.ct-label]:mb-2
          [&_.ct-label-added]:bg-emerald-200 [&_.ct-label-added]:text-emerald-800
          [&_.ct-label-removed]:bg-red-100 [&_.ct-label-removed]:text-red-700
          [&_.ct-removed]:block [&_.ct-removed]:bg-red-50 [&_.ct-removed]:border-l-[3px] [&_.ct-removed]:border-red-400 [&_.ct-removed]:pl-3 [&_.ct-removed]:my-3 [&_.ct-removed]:rounded-r-md [&_.ct-removed]:opacity-60
          [&_.ct-changed]:inline [&_.ct-changed]:rounded-sm [&_.ct-changed]:bg-amber-50 [&_.ct-changed]:px-0.5 [&_.ct-changed]:ring-1 [&_.ct-changed]:ring-amber-300/60
          [&_.ct-del]:line-through [&_.ct-del]:text-red-500 [&_.ct-del]:mr-1.5 [&_.ct-del]:bg-red-100 [&_.ct-del]:px-0.5 [&_.ct-del]:rounded-sm [&_.ct-del]:not-italic
          [&_.ct-ins]:text-emerald-800 [&_.ct-ins]:bg-emerald-100 [&_.ct-ins]:px-0.5 [&_.ct-ins]:rounded-sm [&_.ct-ins]:font-semibold
        `}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  token,
  onApprove,
  approving,
}: {
  item: RefreshItem;
  token: string;
  onApprove: () => void;
  approving: boolean;
}) {
  const { job, result } = item;
  const status = getItemStatus(item);
  const pageType = job.fields.page_type;
  const refreshUrl = job.fields.refresh_url!;
  const keyword = job.fields.target_keyword;

  const body         = result?.fields["Article body"] ?? "";
  const rawMetaTitle = result?.fields["Meta title"] ?? "";
  const rawMetaDesc  = result?.fields["Meta description"] ?? "";
  const origWordCount = countWords(deriveOriginalBody(body));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 leading-snug mb-1.5">
              {job.fields["Blog Title"]}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {pageType && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PAGE_TYPE_COLORS[pageType] ?? "bg-slate-100 text-slate-600"}`}>
                  {pageType}
                </span>
              )}
              {keyword && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium max-w-[200px] truncate">
                  {keyword}
                </span>
              )}
              <a
                href={refreshUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 max-w-[220px] truncate"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-2.5 h-2.5 shrink-0">
                  <path d="M8 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9M10 2h4v4M14 2 8 8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {refreshUrl.replace(/^https?:\/\//, "").substring(0, 50)}
              </a>
            </div>
          </div>

          {/* Action */}
          {status === "review" && result && (
            <button
              onClick={onApprove}
              disabled={approving}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                  Approve &amp; Publish
                </>
              )}
            </button>
          )}

          {status === "approved" && (
            <span className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-emerald-600">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                <polyline points="2 8 6 12 14 4" />
              </svg>
              Approved — queued to publish
            </span>
          )}

          {status === "running" && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
              <div className="w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              Updating…
            </span>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="px-6 pt-4 shrink-0">
        <HowItWorks status={status} />
      </div>

      {/* Content — in-progress state */}
      {status === "running" && (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div>
            <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[14px] font-medium text-slate-700 mb-1.5">Update in progress</div>
            <p className="text-[13px] text-slate-500 max-w-sm">
              We&apos;re updating the headings and content for this page. This usually takes 2–4 minutes.
            </p>
            <a href={refreshUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[12px] text-indigo-600 hover:underline">
              View current page →
            </a>
          </div>
        </div>
      )}

      {/* Content — scheduled */}
      {status === "proposed" && (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div>
            <div className="text-3xl text-slate-200 mb-3">◆</div>
            <div className="text-[14px] font-medium text-slate-600 mb-1">Scheduled for this month</div>
            <p className="text-[13px] text-slate-400 max-w-sm">
              This page is queued for a content refresh. We&apos;ll update the headings, body copy, and keyword
              targeting — the updated draft will appear here for your review once it&apos;s ready.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      {(status === "review" || status === "approved") && result && (
        <div className="flex-1 flex min-h-0 border-t border-slate-200">
          {/* Left — current (derived from article body) */}
          <div className="flex flex-col w-1/2 border-r border-slate-200 min-h-0">
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                    Current ({origWordCount.toLocaleString()} words)
                  </span>
                </div>
                <a
                  href={refreshUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  View live →
                </a>
              </div>
            </div>
            <OriginalPanel body={body} rawMetaTitle={rawMetaTitle} rawMetaDesc={rawMetaDesc} />
          </div>

          {/* Right — proposed */}
          <div className="flex flex-col w-1/2 min-h-0">
            <div className="px-6 py-3 border-b border-slate-100 bg-indigo-50/40 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-widest">
                  Proposed changes
                </span>
              </div>
            </div>
            <RefreshedPanel result={result} origWordCount={origWordCount} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar list item ─────────────────────────────────────────────────────────

function RefreshListItem({
  item,
  selected,
  onClick,
}: {
  item: RefreshItem;
  selected: boolean;
  onClick: () => void;
}) {
  const status = getItemStatus(item);
  const cfg = STATUS_CONFIG[status];
  const pageType = item.job.fields.page_type;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-colors ${
        selected ? "bg-indigo-50 border-l-2 border-l-indigo-500" : "hover:bg-slate-50 border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${cfg.badge}`}>
          {cfg.label}
        </span>
        {pageType && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PAGE_TYPE_COLORS[pageType] ?? "bg-slate-100 text-slate-500"}`}>
            {pageType}
          </span>
        )}
      </div>

      <p className={`text-[13px] font-medium leading-snug line-clamp-2 ${selected ? "text-indigo-900" : "text-slate-800"}`}>
        {item.job.fields["Blog Title"]}
      </p>

      {item.job.fields.refresh_url && (
        <p className="text-[11px] text-slate-400 truncate mt-1">
          {item.job.fields.refresh_url.replace(/^https?:\/\//, "")}
        </p>
      )}
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ clientPackage }: { clientPackage: string }) {
  const refreshCount = refreshLimit(clientPackage);
  const packageLabel = clientPackage.charAt(0).toUpperCase() + clientPackage.slice(1);

  return (
    <div className="flex-1 flex items-center justify-center text-center px-8">
      <div>
        <div className="text-3xl text-slate-200 mb-4">◇</div>
        <div className="text-[15px] font-medium text-slate-600 mb-2">No content refreshes yet</div>
        <p className="text-[13px] text-slate-400 max-w-sm">
          Each month we identify pages across your site that have keyword gaps, thin content, or outdated headings
          and update them to improve rankings.
        </p>

        <div className="mt-5 text-left bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 max-w-sm mx-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">What gets updated</div>
          <ul className="space-y-2.5">
            {[
              ["Blog posts", "Existing articles updated with stronger keyword targeting, improved structure, and expanded content"],
              ["Service and landing pages", "Headers and body copy adjusted to better match search intent and improve rankings"],
            ].map(([type, desc]) => (
              <li key={type} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-[12px] font-semibold text-slate-700">{type}</div>
                  <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="text-[11px] text-slate-500">
              Your <span className="font-semibold text-slate-700">{packageLabel}</span> plan includes{" "}
              <span className="font-semibold text-slate-700">{refreshCount} content refresh{refreshCount !== 1 ? "es" : ""}</span> per month.
              Updated drafts will appear here for your review before anything goes live.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function ContentOptimization({
  items,
  historicalItems = [],
  token,
  clientPackage,
}: {
  items: RefreshItem[];
  historicalItems?: RefreshItem[];
  token: string;
  clientPackage: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items.find((i) => getItemStatus(i) === "review")?.job.id ?? items[0]?.job.id ?? null
  );
  const [approving, setApproving] = useState(false);
  const [localItems, setLocalItems] = useState<RefreshItem[]>(items);

  const selectedItem = localItems.find((i) => i.job.id === selectedId) ?? null;

  const handleApprove = useCallback(async () => {
    if (!selectedItem?.result) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/portal/content-optimization?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "approve", resultId: selectedItem.result.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve");
      }
      setLocalItems((prev) =>
        prev.map((i) =>
          i.job.id === selectedId
            ? {
                ...i,
                result: i.result
                  ? { ...i.result, fields: { ...i.result.fields, portal_approval: "approved" } }
                  : i.result,
              }
            : i
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [selectedItem, selectedId, token]);

  if (localItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col px-10">
        <EmptyState clientPackage={clientPackage} />
      </div>
    );
  }

  const readyCount    = localItems.filter((i) => getItemStatus(i) === "review").length;
  const runningCount  = localItems.filter((i) => getItemStatus(i) === "running").length;
  const approvedCount = localItems.filter((i) => getItemStatus(i) === "approved").length;
  const scheduledCount= localItems.filter((i) => getItemStatus(i) === "proposed").length;
  const refreshCount  = refreshLimit(clientPackage);
  const packageLabel  = clientPackage.charAt(0).toUpperCase() + clientPackage.slice(1);
  const progressPct   = Math.min(100, Math.round((approvedCount / refreshCount) * 100));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Monthly tracker */}
      <div className="px-10 pb-5">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              This month — {packageLabel} plan
            </div>
            <div className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-800">{approvedCount}</span>
              {" of "}
              <span className="font-semibold text-slate-800">{refreshCount}</span>
              {" refresh"}{refreshCount !== 1 ? "es" : ""}{" approved"}
            </div>
          </div>

          <div className="h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex gap-5">
            {[
              { label: "Scheduled",       count: scheduledCount, dot: "bg-slate-300"   },
              { label: "In Progress",     count: runningCount,   dot: "bg-amber-400"   },
              { label: "Ready to Review", count: readyCount,     dot: "bg-indigo-400"  },
              { label: "Approved",        count: approvedCount,  dot: "bg-emerald-400" },
            ].map(({ label, count, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <span className="text-[12px] text-slate-600">
                  <span className="font-semibold text-slate-800">{count}</span>{" "}
                  <span className="text-slate-400">{label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Master-detail */}
      <div className="flex flex-1 min-h-0" style={{ height: "calc(100vh - 18rem)" }}>
        {/* Left sidebar list */}
        <div className="w-[280px] shrink-0 border-r border-slate-200 flex flex-col bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                Pages
              </span>
              {readyCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/60">
                  {readyCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* This month */}
            {localItems.map((item) => (
              <RefreshListItem
                key={item.job.id}
                item={item}
                selected={selectedId === item.job.id}
                onClick={() => setSelectedId(item.job.id)}
              />
            ))}

            {/* Previous months */}
            {historicalItems.length > 0 && (
              <>
                <div className="px-4 py-2 border-t border-b border-slate-100 bg-slate-50">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Previous months
                  </span>
                </div>
                {historicalItems.map((item) => (
                  <RefreshListItem
                    key={item.job.id}
                    item={item}
                    selected={selectedId === item.job.id}
                    onClick={() => setSelectedId(item.job.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right detail */}
        <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
          {selectedItem ? (
            <DetailPanel
              item={selectedItem}
              token={token}
              onApprove={handleApprove}
              approving={approving}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400">
              Select a page to review
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
