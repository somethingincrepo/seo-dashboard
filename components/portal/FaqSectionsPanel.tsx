"use client";

import { useState, useCallback } from "react";
import { PACKAGE_LABELS } from "@/lib/packages";
import type { PackageTier } from "@/lib/packages";
import type { FaqSection } from "@/lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-rose-50 text-rose-700 ring-rose-200/60",
  High:     "bg-amber-50 text-amber-700 ring-amber-200/60",
  Medium:   "bg-blue-50 text-blue-700 ring-blue-200/60",
  Low:      "bg-slate-100 text-slate-600 ring-slate-200/60",
};

function PriorityBadge({ priority }: { priority: string | null }) {
  const p = priority ?? "Low";
  const cls = PRIORITY_COLORS[p] ?? PRIORITY_COLORS.Low;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${cls}`}>{p}</span>
  );
}

function StatusBadge({ approval }: { approval: string | null }) {
  if (approval === "approved")
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset bg-teal-50 text-teal-700 ring-teal-200/60">Approved</span>;
  if (approval === "skipped")
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset bg-slate-100 text-slate-500 ring-slate-200/60">Skipped</span>;
  return null;
}

// ─── List card (left panel) ────────────────────────────────────────────────────

function SectionCard({
  section,
  selected,
  localApproval,
  onClick,
}: {
  section: FaqSection;
  selected: boolean;
  localApproval?: string;
  onClick: () => void;
}) {
  const path = parsePath(section.page_url);
  const effectiveApproval = localApproval ?? section.portal_approval;
  const isDone = !!effectiveApproval && effectiveApproval !== "pending";
  const qCount = (section.generated_questions ?? []).length;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${
        selected
          ? "bg-teal-50 border-teal-200 shadow-sm"
          : isDone
          ? "bg-slate-50 border-slate-100 opacity-60 hover:opacity-80"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-mono text-slate-700 truncate leading-tight font-medium">{path}</span>
        <div className="shrink-0 flex items-center gap-1.5">
          {isDone ? <StatusBadge approval={effectiveApproval} /> : <PriorityBadge priority={section.priority} />}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-slate-400">
          {qCount} question{qCount !== 1 ? "s" : ""}
        </span>
        {(section.existing_faq_count ?? 0) > 0 && (
          <>
            <span className="text-[11px] text-slate-300">·</span>
            <span className="text-[11px] text-slate-400">{section.existing_faq_count} existing</span>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Detail panel (right) ─────────────────────────────────────────────────────

function DetailPanel({
  section,
  localApproval,
  onApprove,
  onSkip,
}: {
  section: FaqSection;
  localApproval?: string;
  onApprove: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState<"approve" | "skip" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipPending, setSkipPending] = useState(false);

  const effectiveApproval = localApproval ?? section.portal_approval;
  const isApproved = effectiveApproval === "approved";
  const isSkipped = effectiveApproval === "skipped";
  const isDone = isApproved || isSkipped;

  const path = parsePath(section.page_url);
  const questions = section.generated_questions ?? [];

  const handleApprove = async () => {
    if (submitting || isApproved) return;
    setSubmitting("approve");
    setError(null);
    try {
      await onApprove(section.id);
      setFeedback("Approved — this FAQ section will be added to the page.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSkip = async () => {
    if (!skipPending) { setSkipPending(true); setTimeout(() => setSkipPending(false), 4000); return; }
    setSkipPending(false);
    setSubmitting("skip");
    setError(null);
    try {
      await onSkip(section.id);
      setFeedback("Skipped. You can revisit this any time.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header — page identity, front and centre */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Target page</p>
            <h3 className="text-[15px] font-bold text-slate-900 leading-snug truncate">
              {section.page_title || path}
            </h3>
            <a
              href={section.page_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-0.5 text-[12px] font-mono text-teal-600 hover:text-teal-700 transition-colors truncate max-w-full"
            >
              {path}
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
            <PriorityBadge priority={section.priority} />
            {(section.existing_faq_count ?? 0) > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-200/60">
                {section.existing_faq_count} existing FAQ{section.existing_faq_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Page context box */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-[12px]">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[10px] tracking-wider w-10 shrink-0">Page</span>
            <span className="font-mono text-slate-700 truncate">{path}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-slate-400 text-[10px] tracking-wider w-10 shrink-0">Action</span>
            <span className="text-slate-700">
              {(section.existing_faq_count ?? 0) > 0
                ? `Add ${questions.length} new Q&As to supplement ${section.existing_faq_count} existing`
                : `Add ${questions.length} Q&As as a new FAQ section`}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-slate-400 text-[10px] tracking-wider w-10 shrink-0">Date</span>
            <span className="text-slate-500">{formatDate(section.proposed_at)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 space-y-3">
          {feedback && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
              <p className="text-[12px] text-teal-700">{feedback}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              disabled={!!submitting}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-[13px] font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              {submitting === "approve" ? "Approving…" : "Add FAQ section to page"}
            </button>
            <button
              onClick={handleSkip}
              disabled={!!submitting}
              className={`px-4 py-2.5 rounded-xl border text-[13px] disabled:opacity-40 transition-colors ${
                skipPending
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {skipPending ? "Are you sure?" : "Skip"}
            </button>
          </div>
        </div>
      )}

      {isDone && !feedback && (
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-center">
            <StatusBadge approval={effectiveApproval} />
          </div>
        </div>
      )}

      {/* Q&A list — scrollable */}
      <div className="flex-1 px-6 py-5 overflow-y-auto space-y-4">
        <div className="text-[11px] font-bold tracking-widest text-slate-400 mb-1">
          Generated questions &amp; answers
        </div>
        {questions.map((qa, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-white">
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-bold text-teal-600 mt-0.5 shrink-0">Q{i + 1}</span>
                <p className="text-[13px] font-semibold text-slate-800 leading-snug">{qa.q}</p>
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-bold text-slate-400 mt-0.5 shrink-0">A</span>
                <p className="text-[13px] text-slate-600 leading-relaxed">{qa.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Approved row (bottom section) ────────────────────────────────────────────

function ApprovedRow({ section }: { section: FaqSection }) {
  const path = parsePath(section.page_url);
  const qCount = (section.generated_questions ?? []).length;
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-slate-100 last:border-0">
      <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-mono text-slate-700 truncate">{path}</span>
        <p className="text-[11px] text-slate-400 mt-0.5">{qCount} Q&amp;As approved</p>
      </div>
      <span className="text-[11px] text-slate-400 shrink-0">{formatDate(section.proposed_at)}</span>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props {
  items: FaqSection[];
  historicalItems: FaqSection[];
  token: string;
  limit: number;
  clientPackage: PackageTier;
}

export function FaqSectionsPanel({ items, historicalItems, token, limit, clientPackage }: Props) {
  const [sections, setSections] = useState<FaqSection[]>(items);
  const [selectedId, setSelectedId] = useState<string | null>(
    items.find((s) => s.status === "suggested" && s.portal_approval !== "skipped")?.id ?? items[0]?.id ?? null
  );
  const [localDecisions, setLocalDecisions] = useState<Map<string, string>>(new Map());
  const [showSkipped, setShowSkipped] = useState(false);

  const pending = sections.filter(
    (s) => s.status === "suggested" && (localDecisions.get(s.id) ?? s.portal_approval ?? "pending") === "pending"
  );
  const approved = sections.filter(
    (s) => (localDecisions.get(s.id) ?? s.portal_approval) === "approved"
  );
  const skipped = sections.filter(
    (s) => (localDecisions.get(s.id) ?? s.portal_approval) === "skipped"
  );

  const listItems = [...pending, ...approved, ...(showSkipped ? skipped : [])];
  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const implementedCount = approved.length;
  const pct = limit === 0 ? 100 : Math.min(100, Math.round((implementedCount / limit) * 100));
  const done = implementedCount >= limit;

  const pkgBadge: Record<PackageTier, string> = {
    starter:   "bg-slate-100 text-slate-600",
    growth:    "bg-indigo-50 text-indigo-700",
    authority: "bg-violet-50 text-violet-700",
  };

  const handleApprove = useCallback(async (id: string) => {
    await fetch(`/api/portal/faqs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve", token }),
    });
    setLocalDecisions((prev) => new Map(prev).set(id, "approved"));
    const idx = pending.findIndex((s) => s.id === id);
    const next = pending.find((_, i) => i > idx);
    if (next) setTimeout(() => setSelectedId(next.id), 1800);
  }, [pending, token]);

  const handleSkip = useCallback(async (id: string) => {
    await fetch(`/api/portal/faqs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "skip", token }),
    });
    setLocalDecisions((prev) => new Map(prev).set(id, "skipped"));
    const idx = pending.findIndex((s) => s.id === id);
    const next = pending.find((_, i) => i > idx);
    if (next) setTimeout(() => setSelectedId(next.id), 800);
  }, [pending, token]);

  const isEmpty = sections.length === 0 && historicalItems.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">FAQ Sections</h1>
          <p className="text-base text-slate-500 mt-1">
            Review AI-generated question &amp; answer sections for your priority pages.
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-slate-800 mb-0.5">What are FAQ sections?</p>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            FAQ sections answer the questions your visitors are already asking. When marked up with schema, they can appear directly in Google search results as rich snippets — and are cited more often by AI tools like ChatGPT and Google&rsquo;s AI Overviews. Each suggestion below is written specifically for the page shown and uses your site&rsquo;s existing content as context.
          </p>
        </div>
      </div>

      {/* Quota bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-600">FAQ sections approved this month</span>
              <div className="flex items-center gap-2">
                {pending.length > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60">
                    {pending.length} to review
                  </span>
                )}
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pkgBadge[clientPackage]}`}>
                  {PACKAGE_LABELS[clientPackage]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-teal-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-[13px] font-semibold tabular-nums shrink-0 ${done ? "text-emerald-600" : "text-slate-700"}`}>
                {implementedCount} / {limit}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Master-detail */}
      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800 mb-2">FAQ sections on the way</h3>
          <p className="text-[13px] text-slate-400 max-w-sm mx-auto leading-relaxed">
            We generate FAQ sections after your audit completes and refresh them monthly. The first batch usually appears within an hour of your audit finishing.
          </p>
        </div>
      ) : listItems.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] overflow-hidden flex h-[calc(100vh-22rem)] min-h-[480px]">
          {/* Left: list */}
          <div className="w-[300px] shrink-0 border-r border-slate-100 flex flex-col">
            <div className="px-3 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-700">
                {pending.length > 0 ? `${pending.length} to review` : "All reviewed"}
              </span>
              {skipped.length > 0 && (
                <button
                  onClick={() => setShowSkipped(!showSkipped)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showSkipped ? "Hide skipped" : `${skipped.length} skipped`}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {listItems.map((s) => (
                <SectionCard
                  key={s.id}
                  section={s}
                  selected={s.id === selectedId}
                  localApproval={localDecisions.get(s.id)}
                  onClick={() => setSelectedId(s.id)}
                />
              ))}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <DetailPanel
                key={selected.id}
                section={selected}
                localApproval={localDecisions.get(selected.id)}
                onApprove={handleApprove}
                onSkip={handleSkip}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
                <svg className="w-8 h-8 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-[13px] text-slate-400">Select a page on the left to review its generated FAQ content.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Approved this month */}
      {approved.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-slate-800">Approved this month</h2>
              <p className="text-[11px] text-slate-400">
                {approved.length} FAQ section{approved.length !== 1 ? "s" : ""} queued for implementation
              </p>
            </div>
          </div>
          <div>
            {approved.map((s) => <ApprovedRow key={s.id} section={s} />)}
          </div>
        </div>
      )}

      {/* Historical */}
      {historicalItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-[13px] font-semibold text-slate-800">Previous months</h2>
          </div>
          <div>
            {historicalItems.map((s) => <ApprovedRow key={s.id} section={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
