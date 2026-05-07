"use client";

import { useState, useCallback } from "react";
import { bracketToHtml, bracketToHtmlProposed } from "@/lib/bracketToHtml";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import type { ContentRefresh } from "@/lib/supabase";

// ── Package allocation helper ─────────────────────────────────────────────────

function refreshLimit(pkg: string): number {
 return PACKAGES[(pkg as PackageTier) in PACKAGES ? (pkg as PackageTier) : "starter"].content_refreshes;
}

// ── Status mapping ────────────────────────────────────────────────────────────

type UiStatus = "review" | "running" | "approved" | "proposed" | "failed";

function getUiStatus(r: ContentRefresh): UiStatus {
 if (r.status === "failed") return "failed";
 if (r.status === "completed" && !r.portal_approval) return "review";
 if (r.status === "in_progress") return "running";
 if (r.portal_approval === "approved" || r.status === "approved_for_publish" || r.status === "published")
 return "approved";
 return "proposed";
}

const STATUS_CONFIG: Record<UiStatus, { label: string; dot: string; badge: string }> = {
 review: { label: "Ready for Review", dot: "bg-indigo-400", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200/60" },
 running: { label: "Update in Progress", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 ring-amber-200/60" },
 approved: { label: "Approved", dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
 proposed: { label: "Scheduled", dot: "bg-slate-300", badge: "bg-slate-100 text-slate-500 ring-slate-200/60" },
 failed: { label: "Validation Failed", dot: "bg-red-400", badge: "bg-red-50 text-red-700 ring-red-200/60" },
};

const PAGE_TYPE_COLORS: Record<string, string> = {
 "Blog Post": "bg-blue-50 text-blue-700",
 "Service Page": "bg-violet-50 text-violet-700",
 "Landing Page": "bg-emerald-50 text-emerald-700",
 "Other": "bg-slate-100 text-slate-600",
};

// Strip bracket markup to count words
function countWords(body: string): number {
 return body.replace(/\[\/?\w+[^\]]*\]/g, " ").split(/\s+/).filter((w) => w.length > 1).length;
}

// Strip change markers, returning clean text
function cleanMetaText(text: string): string {
 return text
 .replace(/\[CHANGED from="[^"]*"\]([\s\S]*?)\[\/CHANGED\]/g, "$1")
 .replace(/\[ADDED\]([\s\S]*?)\[\/ADDED\]/g, "$1")
 .replace(/\[REMOVED\][\s\S]*?\[\/REMOVED\]/g, "")
 .replace(/\[\/?\w+[^\]]*\]/g, "")
 .trim();
}

const PROSE_CLASSES = `
 text-[15px] text-slate-700 leading-[1.7]
 [&_h1]:text-[24px] [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-5 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-slate-200 [&_h1]:leading-tight
 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:leading-snug
 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-5 [&_h3]:mb-2
 [&_p]:mb-4 [&_p]:leading-[1.7]
 [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5
 [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5
 [&_li]:text-[15px] [&_li]:leading-[1.65]
 [&_strong]:font-semibold [&_strong]:text-slate-900
`.trim().replace(/\s+/g, " ");

// ── How it works strip ────────────────────────────────────────────────────────

function HowItWorks({ status }: { status: UiStatus }) {
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
 <div className="text-[11px] font-semibold text-slate-400 tracking-widest mb-3">
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

// ── Original page panel ───────────────────────────────────────────────────────

// ── Stacked change list ───────────────────────────────────────────────────────
//
// Replaces the side-by-side "Current | Proposed changes" panels with a single
// vertical stack of comparison boxes. Each box surfaces exactly one change
// (meta title, meta description, or a [CHANGED]/[ADDED] block from the body),
// with the current version on top, a horizontal divider, then the proposed
// version below. New sections (no current equivalent) get their own box
// labeled "Added" instead of the divided two-row layout.

type ChangeItem =
 | { type: "meta_title"; current: string; proposed: string }
 | { type: "meta_description"; current: string; proposed: string }
 | { type: "changed"; current: string; proposed: string }
 | { type: "added"; proposed: string };

function buildChangeStack(refresh: ContentRefresh): ChangeItem[] {
 const items: ChangeItem[] = [];

 const oldTitle = refresh.original_meta_title ?? "";
 const newTitle = cleanMetaText(refresh.proposed_meta_title ?? "");
 if (newTitle && oldTitle !== newTitle) {
 items.push({ type: "meta_title", current: oldTitle, proposed: newTitle });
 }

 const oldDesc = refresh.original_meta_description ?? "";
 const newDesc = cleanMetaText(refresh.proposed_meta_description ?? "");
 if (newDesc && oldDesc !== newDesc) {
 items.push({ type: "meta_description", current: oldDesc, proposed: newDesc });
 }

 const body = refresh.proposed_body ?? "";
 // Single sweep so CHANGED and ADDED blocks appear in the same order they do
 // on the page. Using non-greedy match for both forms.
 const re = /\[CHANGED from="([^"]*)"\]([\s\S]*?)\[\/CHANGED\]|\[ADDED\]([\s\S]*?)\[\/ADDED\]/g;
 for (const m of body.matchAll(re)) {
 if (m[1] !== undefined && m[2] !== undefined) {
 items.push({ type: "changed", current: m[1], proposed: m[2] });
 } else if (m[3] !== undefined) {
 items.push({ type: "added", proposed: m[3] });
 }
 }

 return items;
}

const STACK_PROSE = `
 [&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h1]:mb-2
 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-4 [&_h2]:mb-2
 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-3 [&_h3]:mb-1.5
 [&_p]:text-[15px] [&_p]:text-slate-700 [&_p]:leading-[1.7] [&_p]:mb-3
 [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1.5
 [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1.5
 [&_li]:text-[15px] [&_li]:text-slate-700 [&_li]:leading-[1.65]
 [&_strong]:font-semibold [&_strong]:text-slate-900
`.trim().replace(/\s+/g, " ");

function ChangeBox({ item, index, total }: { item: ChangeItem; index: number; total: number }) {
 const isAdded = item.type === "added";
 const labelText = isAdded ? "Added" : "Updated";
 const contextLabel =
 item.type === "meta_title" ? "Meta title"
 : item.type === "meta_description" ? "Meta description"
 : item.type === "added" ? "New section"
 : null;

 const renderText = (raw: string, plainText: boolean) => {
 if (plainText) {
 return <p className="text-[15px] text-slate-700 leading-[1.6]">{raw}</p>;
 }
 return (
 <div
 className={STACK_PROSE}
 dangerouslySetInnerHTML={{ __html: bracketToHtml(raw) }}
 />
 );
 };

 const isMeta = item.type === "meta_title" || item.type === "meta_description";

 return (
 <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
 <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
 <span className="text-[11px] font-medium text-slate-700 bg-white ring-1 ring-slate-300 rounded px-1.5 py-0.5">
 {labelText}
 </span>
 {contextLabel && (
 <span className="text-[12px] text-slate-500">{contextLabel}</span>
 )}
 <span className="text-[11px] text-slate-400 ml-auto">
 {index + 1} of {total}
 </span>
 </div>

 {item.type !== "added" && (
 <>
 <div className="px-4 py-3">
 <div className="text-[11px] font-medium text-slate-400 mb-1.5">Current</div>
 {renderText(item.current, isMeta)}
 </div>
 <div className="border-t border-slate-200 mx-4" aria-hidden="true" />
 </>
 )}

 <div className={`px-4 py-3 ${isAdded ? "" : "bg-slate-50/40"}`}>
 <div className="text-[11px] font-medium text-slate-400 mb-1.5">
 {isAdded ? "New content" : "Proposed"}
 </div>
 {renderText(item.proposed, isMeta)}
 </div>
 </div>
 );
}

function ChangeStack({ refresh }: { refresh: ContentRefresh }) {
 const items = buildChangeStack(refresh);
 const refreshUrl = refresh.refresh_url;

 if (items.length === 0) {
 return (
 <div className="px-6 py-10 text-center">
 <p className="text-[14px] text-slate-500">
 No changes proposed for this page.
 </p>
 <a
 href={refreshUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-block mt-2 text-[12px] text-indigo-600 hover:underline"
 >
 View live page →
 </a>
 </div>
 );
 }

 return (
 <div className="px-6 py-5 space-y-4 overflow-y-auto">
 <div className="text-[12px] text-slate-500">
 {items.length} change{items.length === 1 ? "" : "s"} proposed for this page · compare each against the current version below
 </div>
 {items.map((item, i) => (
 <ChangeBox key={i} item={item} index={i} total={items.length} />
 ))}
 </div>
 );
}

function OriginalPanel({ refresh }: { refresh: ContentRefresh }) {
 // Original body has no change markers, so the standard bracket renderer is fine.
 const html = bracketToHtml(refresh.original_body);
 const origTitle = refresh.original_meta_title;
 const origDesc = refresh.original_meta_description;

 return (
 <div className="flex-1 overflow-y-auto px-6 py-5">
 {(origTitle || origDesc) && (
 <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6 space-y-3">
 {origTitle && (
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[12px] font-medium text-slate-500">Meta title</span>
 <span className={`text-[11px] ${origTitle.length > 60 ? "text-red-500 font-semibold" : "text-slate-400"}`}>
 {origTitle.length}/60
 </span>
 </div>
 <p className="text-[14px] text-slate-800 font-medium leading-snug">{origTitle}</p>
 </div>
 )}
 {origDesc && (
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[12px] font-medium text-slate-500">Meta description</span>
 <span className={`text-[11px] ${origDesc.length > 155 ? "text-red-500 font-semibold" : "text-slate-400"}`}>
 {origDesc.length}/155
 </span>
 </div>
 <p className="text-[14px] text-slate-700 leading-relaxed">{origDesc}</p>
 </div>
 )}
 </div>
 )}

 <div className={PROSE_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />
 </div>
 );
}

// ── Refreshed content panel ───────────────────────────────────────────────────

function RefreshedPanel({ refresh }: { refresh: ContentRefresh }) {
 const body = refresh.proposed_body;
 // Render the clean proposed version — no inline strikethroughs, no del/ins
 // mixing. The OriginalPanel on the left already shows the current text;
 // here we show what the page will look like once approved.
 const html = bracketToHtmlProposed(body);
 const wordCount = refresh.proposed_word_count ?? countWords(body);
 const origWordCount = refresh.original_word_count;
 const rawMetaTitle = refresh.proposed_meta_title;
 const rawMetaDesc = refresh.proposed_meta_description;
 const newMetaTitle = cleanMetaText(rawMetaTitle);
 const newMetaDesc = cleanMetaText(rawMetaDesc);

 const delta = wordCount - origWordCount;
 const deltaLabel = delta > 0
 ? `+${delta.toLocaleString()} vs. current`
 : delta < 0
 ? `${delta.toLocaleString()} vs. current`
 : "same length as current";
 const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400";

 const hasChangeMarkers = /\[ADDED\]|\[CHANGED |\[REMOVED\]/.test(body);
 const hasChangeStats = typeof refresh.change_ratio === "number";

 const titleChanged = refresh.original_meta_title && refresh.original_meta_title !== newMetaTitle;
 const descChanged = refresh.original_meta_description && refresh.original_meta_description !== newMetaDesc;

 return (
 <div className="flex-1 overflow-y-auto px-6 py-5">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3 flex-wrap">
 <span className="text-[12px] text-slate-500">
 ~{wordCount.toLocaleString()} words
 </span>
 <span className={`text-[12px] ${deltaColor}`}>
 {deltaLabel}
 </span>
 {hasChangeStats && (
 <span className="text-[12px] text-slate-500">
 {Math.round((refresh.change_ratio ?? 0) * 100)}% changed
 {refresh.edits_count > 0 && ` · ${refresh.edits_count} edit${refresh.edits_count === 1 ? "" : "s"}`}
 {refresh.additions_count > 0 && ` · ${refresh.additions_count} added`}
 </span>
 )}
 </div>
 </div>

 {hasChangeMarkers && (
 <div className="flex items-center gap-3 mb-5 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
 <span className="text-[12px] text-slate-500">
 <em className="text-slate-700">Italicized text</em> marks proposed updates · sections labeled <span className="inline-flex items-center px-1.5 py-0.5 rounded ring-1 ring-slate-300 bg-white text-[10px] font-medium text-slate-600">New</span> are entirely new
 </span>
 </div>
 )}

 {(rawMetaTitle || rawMetaDesc) && (
 <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6 space-y-3">
 {rawMetaTitle && (
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[12px] font-medium text-slate-500">Meta title</span>
 <span className={`text-[11px] ${newMetaTitle.length > 60 ? "text-red-500 font-semibold" : "text-slate-400"}`}>
 {newMetaTitle.length}/60
 </span>
 {titleChanged && (
 <span className="text-[10px] font-medium text-slate-600 bg-white ring-1 ring-slate-300 rounded px-1.5 py-0.5">Updated</span>
 )}
 </div>
 <div className={`text-[14px] text-slate-800 font-medium leading-snug ${titleChanged ? "italic" : ""}`}>{newMetaTitle}</div>
 </div>
 )}
 {rawMetaDesc && (
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[12px] font-medium text-slate-500">Meta description</span>
 <span className={`text-[11px] ${newMetaDesc.length > 155 ? "text-red-500 font-semibold" : "text-slate-400"}`}>
 {newMetaDesc.length}/155
 </span>
 {descChanged && (
 <span className="text-[10px] font-medium text-slate-600 bg-white ring-1 ring-slate-300 rounded px-1.5 py-0.5">Updated</span>
 )}
 </div>
 <div className={`text-[14px] text-slate-700 leading-relaxed ${descChanged ? "italic" : ""}`}>{newMetaDesc}</div>
 </div>
 )}
 </div>
 )}

 <div
 className={`
 ${PROSE_CLASSES}
 [&_.ct-added]:relative [&_.ct-added]:block [&_.ct-added]:my-6
 [&_.ct-label-added]:inline-flex [&_.ct-label-added]:items-center [&_.ct-label-added]:px-1.5 [&_.ct-label-added]:py-0.5 [&_.ct-label-added]:rounded [&_.ct-label-added]:ring-1 [&_.ct-label-added]:ring-slate-300 [&_.ct-label-added]:bg-white [&_.ct-label-added]:text-[10px] [&_.ct-label-added]:font-medium [&_.ct-label-added]:text-slate-600 [&_.ct-label-added]:mb-2
 [&_em]:italic [&_em]:text-slate-800
 `}
 dangerouslySetInnerHTML={{ __html: html }}
 />
 </div>
 );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
 refresh,
 onApprove,
 approving,
}: {
 refresh: ContentRefresh;
 onApprove: () => void;
 approving: boolean;
}) {
 const status = getUiStatus(refresh);
 const refreshUrl = refresh.refresh_url;

 return (
 <div className="flex flex-col h-full min-h-0">
 <div className="px-6 py-4 border-b border-slate-200 shrink-0">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h2 className="text-[15px] font-semibold text-slate-900 leading-snug mb-1.5">
 {refresh.display_title || refreshUrl}
 </h2>
 <div className="flex flex-wrap items-center gap-1.5">
 {refresh.page_type && (
 <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PAGE_TYPE_COLORS[refresh.page_type] ?? "bg-slate-100 text-slate-600"}`}>
 {refresh.page_type}
 </span>
 )}
 {refresh.target_keyword && (
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium max-w-[200px] truncate">
 {refresh.target_keyword}
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

 {status === "review" && (
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

 <div className="px-6 pt-4 shrink-0">
 <HowItWorks status={status} />
 </div>

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

 {status === "failed" && (
 <div className="flex-1 flex items-center justify-center text-center px-8">
 <div>
 <div className="text-3xl text-red-300 mb-3">!</div>
 <div className="text-[14px] font-medium text-red-700 mb-1">Refresh did not pass validation</div>
 <p className="text-[13px] text-slate-500 max-w-sm">
 The proposed edits failed our deterministic checks. Our team has been alerted and the job will be retried.
 </p>
 {refresh.validation_errors.length > 0 && (
 <ul className="mt-3 text-left text-[11px] text-red-600 max-w-sm mx-auto list-disc pl-5 space-y-0.5">
 {refresh.validation_errors.slice(0, 5).map((err, i) => (
 <li key={i}>{err}</li>
 ))}
 </ul>
 )}
 </div>
 </div>
 )}

 {(status === "review" || status === "approved") && (
 <div className="flex-1 min-h-0 overflow-hidden border-t border-slate-200 flex flex-col">
 <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0 flex items-center justify-between">
 <span className="text-[12px] text-slate-500">
 Proposed changes for this page
 </span>
 <a
 href={refreshUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
 >
 View live page →
 </a>
 </div>
 <ChangeStack refresh={refresh} />
 </div>
 )}
 </div>
 );
}

// ── Sidebar list item ─────────────────────────────────────────────────────────

function RefreshListItem({
 refresh,
 selected,
 onClick,
}: {
 refresh: ContentRefresh;
 selected: boolean;
 onClick: () => void;
}) {
 const status = getUiStatus(refresh);
 const cfg = STATUS_CONFIG[status];

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
 {refresh.page_type && (
 <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PAGE_TYPE_COLORS[refresh.page_type] ?? "bg-slate-100 text-slate-500"}`}>
 {refresh.page_type}
 </span>
 )}
 </div>

 <p className={`text-[13px] font-medium leading-snug line-clamp-2 ${selected ? "text-indigo-900" : "text-slate-800"}`}>
 {refresh.display_title || refresh.refresh_url}
 </p>

 <p className="text-[11px] text-slate-400 truncate mt-1">
 {refresh.refresh_url.replace(/^https?:\/\//, "")}
 </p>
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
 <div className="text-[15px] font-medium text-slate-600 mb-2">First refresh batch on the way</div>
 <p className="text-[13px] text-slate-400 max-w-sm">
 The refresh scheduler runs at audit time and weekly thereafter, picking pages from your audit
 to update with stronger keyword targeting, improved structure, and expanded content. The first
 batch usually appears here within an hour of the audit completing.
 </p>

 <div className="mt-5 text-left bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 max-w-sm mx-auto">
 <div className="text-[10px] font-semibold text-slate-400 tracking-widest mb-3">What gets updated</div>
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
 items: ContentRefresh[];
 historicalItems?: ContentRefresh[];
 token: string;
 clientPackage: string;
}) {
 const [selectedId, setSelectedId] = useState<string | null>(
 items.find((r) => getUiStatus(r) === "review")?.id ?? items[0]?.id ?? null
 );
 const [approving, setApproving] = useState(false);
 const [localItems, setLocalItems] = useState<ContentRefresh[]>(items);

 const selectedItem = localItems.find((r) => r.id === selectedId) ?? historicalItems.find((r) => r.id === selectedId) ?? null;

 const handleApprove = useCallback(async () => {
 if (!selectedItem) return;
 setApproving(true);
 try {
 const res = await fetch(`/api/portal/content-optimization?token=${token}`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ type: "approve", refreshId: selectedItem.id }),
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error(data.error ?? "Failed to approve");
 }
 setLocalItems((prev) =>
 prev.map((r) =>
 r.id === selectedId
 ? { ...r, portal_approval: "approved", status: "approved_for_publish" as const }
 : r
 )
 );
 } catch (e) {
 alert(e instanceof Error ? e.message : "Approval failed");
 } finally {
 setApproving(false);
 }
 }, [selectedItem, selectedId, token]);

 if (localItems.length === 0 && historicalItems.length === 0) {
 return (
 <div className="flex-1 flex flex-col px-10">
 <EmptyState clientPackage={clientPackage} />
 </div>
 );
 }

 const readyCount = localItems.filter((r) => getUiStatus(r) === "review").length;
 const runningCount = localItems.filter((r) => getUiStatus(r) === "running").length;
 const approvedCount = localItems.filter((r) => getUiStatus(r) === "approved").length;
 const scheduledCount= localItems.filter((r) => getUiStatus(r) === "proposed").length;
 const refreshCount = refreshLimit(clientPackage);
 const packageLabel = clientPackage.charAt(0).toUpperCase() + clientPackage.slice(1);
 const progressPct = Math.min(100, Math.round((approvedCount / refreshCount) * 100));

 return (
 <div className="flex flex-col flex-1 min-h-0">
 <div className="px-10 pb-5">
 <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
 <div className="flex items-center justify-between mb-3">
 <div className="text-[11px] font-semibold text-slate-400 tracking-widest">
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
 { label: "Scheduled", count: scheduledCount, dot: "bg-slate-300" },
 { label: "In Progress", count: runningCount, dot: "bg-amber-400" },
 { label: "Ready to Review", count: readyCount, dot: "bg-indigo-400" },
 { label: "Approved", count: approvedCount, dot: "bg-emerald-400" },
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

 <div className="flex flex-1 min-h-0" style={{ height: "calc(100vh - 18rem)" }}>
 <div className="w-[280px] shrink-0 border-r border-slate-200 flex flex-col bg-white overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-semibold text-slate-500 tracking-widest">
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
 {localItems.map((refresh) => (
 <RefreshListItem
 key={refresh.id}
 refresh={refresh}
 selected={selectedId === refresh.id}
 onClick={() => setSelectedId(refresh.id)}
 />
 ))}

 {historicalItems.length > 0 && (
 <>
 <div className="px-4 py-2 border-t border-b border-slate-100 bg-slate-50">
 <span className="text-[10px] font-semibold text-slate-400 tracking-widest">
 Previous months
 </span>
 </div>
 {historicalItems.map((refresh) => (
 <RefreshListItem
 key={refresh.id}
 refresh={refresh}
 selected={selectedId === refresh.id}
 onClick={() => setSelectedId(refresh.id)}
 />
 ))}
 </>
 )}
 </div>
 </div>

 <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
 {selectedItem ? (
 <DetailPanel
 refresh={selectedItem}
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
