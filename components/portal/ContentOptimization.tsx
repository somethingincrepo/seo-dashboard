"use client";

import { Fragment, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { bracketToHtml, bracketToHtmlProposed } from "@/lib/bracketToHtml";
import { wordDiff } from "@/lib/wordDiff";
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

// Body prose for both columns of the comparison grid. Each h2 gets a soft
// horizontal divider above it (skipped on the first h2 in a cell so the
// content doesn't open with a bare line). Same prose styling on both sides
// so corresponding sections render at matching heights.
const PROSE_CLASSES = `
 text-[15px] text-slate-700 leading-[1.7]
 [&_h1]:text-[24px] [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-5 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-slate-200 [&_h1]:leading-tight
 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:leading-snug [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-slate-200 [&_h2:first-child]:border-t-0 [&_h2:first-child]:pt-0 [&_h2:first-child]:mt-0
 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-5 [&_h3]:mb-2
 [&_p]:mb-4 [&_p]:leading-[1.7]
 [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5
 [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5
 [&_li]:text-[15px] [&_li]:leading-[1.65]
 [&_strong]:font-semibold [&_strong]:text-slate-900
 [&_em]:italic
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

function DiffedMeta({ oldText, newText, className }: { oldText: string; newText: string; className: string }) {
 const tokens = wordDiff(oldText, newText);
 return (
 <div className={className}>
 {tokens.map((t, i) =>
 t.changed ? (
 <strong key={i} className="italic font-bold text-slate-900">{t.text}</strong>
 ) : (
 <span key={i}>{t.text}</span>
 ),
 )}
 </div>
 );
}

// ── Aligned-section grid ──────────────────────────────────────────────────────
//
// Splits both bodies into sections (h2-bounded, plus an "intro" block before
// the first h2, plus [ADDED] blocks treated as their own sections), pairs
// matching sections by position, and renders them in a 2-column CSS grid so
// the corresponding original/proposed sections align horizontally. A single
// horizontal line spans across both columns between rows.

type Block = { kind: "intro" | "section" | "added"; markup: string };

function splitBody(body: string): Block[] {
 if (!body) return [];
 const blocks: Block[] = [];
 const lines = body.split("\n");
 let buf: string[] = [];
 let kind: "intro" | "section" = "intro";

 const flush = () => {
 const m = buf.join("\n").trim();
 if (m) blocks.push({ kind, markup: m });
 buf = [];
 };

 for (let i = 0; i < lines.length; i++) {
 const line = lines[i];

 if (/^\s*\[ADDED\]\s*$/.test(line)) {
 flush();
 const inner: string[] = [];
 i++;
 while (i < lines.length && !/^\s*\[\/ADDED\]\s*$/.test(lines[i])) {
 inner.push(lines[i]);
 i++;
 }
 const m = inner.join("\n").trim();
 if (m) blocks.push({ kind: "added", markup: m });
 continue;
 }

 // Split at H1 OR H2 — many real-world pages use H1 for what are
 // logically section headings (every blog index page lists each post
 // with an H1, for instance). Splitting only at H2 collapses all those
 // sections into one giant "intro" block and breaks pairing with the
 // original. Treating both as section delimiters fixes that without
 // hurting pages that use H1 only for the page title (those just get
 // a single section that owns the whole page, which is fine).
 if (/^\s*\[H[12]\]/.test(line)) {
 flush();
 kind = "section";
 }

 buf.push(line);
 }
 flush();
 return blocks;
}

type Pair =
 | { kind: "matched"; original: string | null; proposed: string; proposedIndex: number }
 | { kind: "added"; proposed: string; proposedIndex: number };

function pairSections(originalBody: string, proposedBody: string): Pair[] {
 const orig = splitBody(originalBody).filter((b) => b.kind !== "added");
 const prop = splitBody(proposedBody);
 const pairs: Pair[] = [];
 let oi = 0;
 prop.forEach((pb, idx) => {
 if (pb.kind === "added") {
 pairs.push({ kind: "added", proposed: pb.markup, proposedIndex: idx });
 } else {
 pairs.push({
 kind: "matched",
 original: orig[oi]?.markup ?? null,
 proposed: pb.markup,
 proposedIndex: idx,
 });
 oi++;
 }
 });
 return pairs;
}

function joinBlocks(blocks: Block[]): string {
 return blocks
 .map((b) => (b.kind === "added" ? `[ADDED]\n${b.markup}\n[/ADDED]` : b.markup))
 .join("\n\n");
}

type EditField = "proposed_meta_title" | "proposed_meta_description" | "proposed_body";

function EditButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
 return (
 <button
 type="button"
 onClick={onClick}
 disabled={busy}
 className="text-[11px] text-slate-500 hover:text-indigo-600 underline-offset-2 hover:underline disabled:opacity-40 transition-colors"
 >
 Edit
 </button>
 );
}

function InlineEditor({
 initial,
 onSave,
 onCancel,
 multiline,
 maxChars,
}: {
 initial: string;
 onSave: (v: string) => Promise<void>;
 onCancel: () => void;
 multiline: boolean;
 maxChars?: number;
}) {
 const [draft, setDraft] = useState(initial);
 const [saving, setSaving] = useState(false);
 const [err, setErr] = useState<string | null>(null);
 const submit = async () => {
 setSaving(true);
 setErr(null);
 try {
 await onSave(draft);
 } catch (e) {
 setErr(e instanceof Error ? e.message : "Save failed");
 setSaving(false);
 }
 };
 return (
 <div>
 {multiline ? (
 <textarea
 value={draft}
 onChange={(e) => setDraft(e.target.value)}
 rows={6}
 className="w-full text-[14px] leading-relaxed p-2 rounded border border-slate-300 focus:border-indigo-400 focus:outline-none"
 disabled={saving}
 />
 ) : (
 <input
 type="text"
 value={draft}
 onChange={(e) => setDraft(e.target.value)}
 className="w-full text-[15px] p-2 rounded border border-slate-300 focus:border-indigo-400 focus:outline-none"
 disabled={saving}
 />
 )}
 <div className="flex items-center gap-2 mt-2">
 <button
 type="button"
 onClick={submit}
 disabled={saving || draft === initial}
 className="text-[12px] px-3 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
 >
 {saving ? "Saving…" : "Save"}
 </button>
 <button
 type="button"
 onClick={onCancel}
 disabled={saving}
 className="text-[12px] px-3 py-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-40"
 >
 Cancel
 </button>
 {maxChars !== undefined && (
 <span className={`text-[11px] ml-auto ${draft.length > maxChars ? "text-red-500 font-semibold" : "text-slate-400"}`}>
 {draft.length}/{maxChars}
 </span>
 )}
 {err && <span className="text-[11px] text-red-500">{err}</span>}
 </div>
 </div>
 );
}

function ComparisonGrid({
 refresh,
 onEdit,
}: {
 refresh: ContentRefresh;
 onEdit: (refreshId: string, field: EditField, value: string) => Promise<void>;
}) {
 const oldTitle = refresh.original_meta_title ?? "";
 const newTitle = cleanMetaText(refresh.proposed_meta_title ?? "");
 const oldDesc = refresh.original_meta_description ?? "";
 const newDesc = cleanMetaText(refresh.proposed_meta_description ?? "");
 const titleChanged = !!oldTitle && oldTitle !== newTitle;
 const descChanged = !!oldDesc && oldDesc !== newDesc;

 const pairs = pairSections(refresh.original_body ?? "", refresh.proposed_body ?? "");

 const cellLeft = "px-6 py-5";
 const cellRight = "px-6 py-5 border-l border-slate-200";
 const proseClass = PROSE_CLASSES;

 // editing state: null when nothing is being edited; otherwise either a meta
 // field name or { kind: "body", index } for a body-section edit (the index
 // is the position in splitBody(proposed_body), so saves can rebuild
 // proposed_body in place).
 type EditingState =
 | null
 | { kind: "meta"; field: "proposed_meta_title" | "proposed_meta_description" }
 | { kind: "body"; index: number };
 const [editing, setEditing] = useState<EditingState>(null);

 const saveMeta = async (field: "proposed_meta_title" | "proposed_meta_description", value: string) => {
 await onEdit(refresh.id, field, value);
 setEditing(null);
 };

 // Save a single body section by rebuilding proposed_body from splitBody's
 // blocks with the edited block swapped in at its original index. This keeps
 // every other section verbatim and preserves [ADDED]/[/ADDED] wrappers.
 const saveBodySection = async (index: number, value: string) => {
 const blocks = splitBody(refresh.proposed_body ?? "");
 if (!blocks[index]) {
 throw new Error("Could not locate this section in the proposed body");
 }
 blocks[index] = { ...blocks[index], markup: value.trim() };
 const newBody = joinBlocks(blocks);
 await onEdit(refresh.id, "proposed_body", newBody);
 setEditing(null);
 };

 const isMetaEditing = (field: "proposed_meta_title" | "proposed_meta_description") =>
 editing?.kind === "meta" && editing.field === field;
 const isBodyEditing = (idx: number) =>
 editing?.kind === "body" && editing.index === idx;

 const rows: Array<{ left: React.ReactNode; right: React.ReactNode; key: string }> = [];

 if (newTitle || oldTitle) {
 rows.push({
 key: "meta-title",
 left: oldTitle ? (
 <div>
 <div className="text-[11px] font-medium text-slate-400 mb-1">Meta title</div>
 <div className="text-[15px] text-slate-700 leading-snug">{oldTitle}</div>
 </div>
 ) : <div className="text-[12px] text-slate-400">No current meta title</div>,
 right: (
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[11px] font-medium text-slate-400">Meta title</span>
 {titleChanged && (
 <span className="text-[10px] font-medium text-slate-700 bg-white ring-1 ring-slate-300 rounded px-1.5 py-0.5">Updated</span>
 )}
 <span className="ml-auto" />
 {!isMetaEditing("proposed_meta_title") && (
 <EditButton onClick={() => setEditing({ kind: "meta", field: "proposed_meta_title" })} busy={false} />
 )}
 </div>
 {isMetaEditing("proposed_meta_title") ? (
 <InlineEditor
 initial={newTitle}
 onSave={(v) => saveMeta("proposed_meta_title", v)}
 onCancel={() => setEditing(null)}
 multiline={false}
 maxChars={60}
 />
 ) : titleChanged ? (
 <DiffedMeta oldText={oldTitle} newText={newTitle} className="text-[15px] leading-snug text-slate-700" />
 ) : (
 <div className="text-[15px] leading-snug text-slate-700">{newTitle}</div>
 )}
 </div>
 ),
 });
 }

 if (newDesc || oldDesc) {
 rows.push({
 key: "meta-desc",
 left: oldDesc ? (
 <div>
 <div className="text-[11px] font-medium text-slate-400 mb-1">Meta description</div>
 <div className="text-[14px] text-slate-700 leading-relaxed">{oldDesc}</div>
 </div>
 ) : <div className="text-[12px] text-slate-400">No current meta description</div>,
 right: (
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[11px] font-medium text-slate-400">Meta description</span>
 {descChanged && (
 <span className="text-[10px] font-medium text-slate-700 bg-white ring-1 ring-slate-300 rounded px-1.5 py-0.5">Updated</span>
 )}
 <span className="ml-auto" />
 {!isMetaEditing("proposed_meta_description") && (
 <EditButton onClick={() => setEditing({ kind: "meta", field: "proposed_meta_description" })} busy={false} />
 )}
 </div>
 {isMetaEditing("proposed_meta_description") ? (
 <InlineEditor
 initial={newDesc}
 onSave={(v) => saveMeta("proposed_meta_description", v)}
 onCancel={() => setEditing(null)}
 multiline={true}
 maxChars={155}
 />
 ) : descChanged ? (
 <DiffedMeta oldText={oldDesc} newText={newDesc} className="text-[14px] leading-relaxed text-slate-700" />
 ) : (
 <div className="text-[14px] leading-relaxed text-slate-700">{newDesc}</div>
 )}
 </div>
 ),
 });
 }

 pairs.forEach((p, i) => {
 const editingThis = isBodyEditing(p.proposedIndex);
 if (p.kind === "added") {
 rows.push({
 key: `body-${i}`,
 left: <div className="text-[13px] text-slate-400 italic">No equivalent — this section is new.</div>,
 right: (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="text-[10px] font-medium text-slate-700 bg-white ring-1 ring-slate-300 rounded px-1.5 py-0.5">Added</span>
 <span className="ml-auto" />
 {!editingThis && (
 <EditButton onClick={() => setEditing({ kind: "body", index: p.proposedIndex })} busy={false} />
 )}
 </div>
 {editingThis ? (
 <InlineEditor
 initial={p.proposed}
 onSave={(v) => saveBodySection(p.proposedIndex, v)}
 onCancel={() => setEditing(null)}
 multiline={true}
 />
 ) : (
 <div className={proseClass} dangerouslySetInnerHTML={{ __html: bracketToHtml(p.proposed) }} />
 )}
 </div>
 ),
 });
 } else {
 rows.push({
 key: `body-${i}`,
 left: p.original ? (
 <div className={proseClass} dangerouslySetInnerHTML={{ __html: bracketToHtml(p.original) }} />
 ) : <div className="text-[13px] text-slate-400 italic">— no current content —</div>,
 right: (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="ml-auto" />
 {!editingThis && (
 <EditButton onClick={() => setEditing({ kind: "body", index: p.proposedIndex })} busy={false} />
 )}
 </div>
 {editingThis ? (
 <InlineEditor
 initial={p.proposed}
 onSave={(v) => saveBodySection(p.proposedIndex, v)}
 onCancel={() => setEditing(null)}
 multiline={true}
 />
 ) : (
 <div className={proseClass} dangerouslySetInnerHTML={{ __html: bracketToHtmlProposed(p.proposed) }} />
 )}
 </div>
 ),
 });
 }
 });

 return (
 <div className="flex-1 overflow-y-auto">
 <div className="grid grid-cols-2">
 {rows.map((row, i) => (
 <Fragment key={row.key}>
 {i > 0 && (
 <div
 className="col-span-2 border-t border-slate-200"
 aria-hidden="true"
 />
 )}
 <div className={cellLeft}>{row.left}</div>
 <div className={cellRight}>{row.right}</div>
 </Fragment>
 ))}
 </div>
 </div>
 );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
 refresh,
 onApprove,
 approving,
 onEdit,
}: {
 refresh: ContentRefresh;
 onApprove: () => void;
 approving: boolean;
 onEdit: (refreshId: string, field: EditField, value: string) => Promise<void>;
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
 <div className="flex-1 min-h-0 flex flex-col border-t border-slate-200">
 <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/70 shrink-0">
 <div className="px-6 py-3 flex items-center justify-between">
 <span className="text-[12px] font-medium text-slate-600">
 Current ({refresh.original_word_count.toLocaleString()} words)
 </span>
 <a
 href={refreshUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
 >
 View live →
 </a>
 </div>
 <div className="px-6 py-3 border-l border-slate-200 flex items-center gap-3">
 <span className="text-[12px] font-medium text-slate-600">Proposed</span>
 <span className="text-[11px] text-slate-400">
 <strong className="text-slate-700"><em>Bold italic</em></strong> = updated words · <span className="inline-flex items-center px-1.5 py-0.5 rounded ring-1 ring-slate-300 bg-white text-[10px] font-medium text-slate-600">Added</span> = new section
 </span>
 </div>
 </div>
 <ComparisonGrid refresh={refresh} onEdit={onEdit} />
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
 const router = useRouter();
 const searchParams = useSearchParams();
 const urlId = searchParams.get("id");
 const allRefreshes = [...items, ...(historicalItems ?? [])];
 const [selectedId, setSelectedId] = useState<string | null>(
   urlId && allRefreshes.some(r => r.id === urlId)
     ? urlId
     : items.find((r) => getUiStatus(r) === "review")?.id ?? items[0]?.id ?? null
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
 router.refresh();
 } catch (e) {
 alert(e instanceof Error ? e.message : "Approval failed");
 } finally {
 setApproving(false);
 }
 }, [selectedItem, selectedId, token, router]);

 const handleEdit = useCallback(
 async (refreshId: string, field: "proposed_meta_title" | "proposed_meta_description" | "proposed_body", value: string) => {
 const res = await fetch(`/api/portal/content-optimization?token=${token}`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ type: "edit_proposed", refreshId, field, value }),
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error(data.error ?? "Failed to save");
 }
 setLocalItems((prev) =>
 prev.map((r) => (r.id === refreshId ? { ...r, [field]: value } : r)),
 );
 },
 [token],
 );

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
 onEdit={handleEdit}
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
