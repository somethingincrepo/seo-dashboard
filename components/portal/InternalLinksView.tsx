"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PACKAGE_LABELS } from "@/lib/packages";
import type { PackageTier } from "@/lib/packages";
import type { Change } from "@/lib/changes";

interface InternalLinksViewProps {
  pending: Change[];
  decided: Change[];
  pkg: PackageTier;
  monthlyTarget: number;
  implementedCount: number;
  token: string;
  contactEmail: string;
}

interface LinkProposal {
  source_url: string;
  anchor_text: string;
  target_url: string;
  context: string;
}

function parsePath(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/, "") || "/";
    return p;
  } catch {
    return url;
  }
}

function parseProposal(raw: string): LinkProposal | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw.trim());
    if (p && (p.anchor_text || p.target_url)) return p as LinkProposal;
  } catch {
    // not JSON
  }
  return null;
}

function ConfidenceBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    High: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    Medium: "bg-amber-50 text-amber-700 ring-amber-200/60",
    Low: "bg-slate-100 text-slate-500 ring-slate-200/60",
  };
  const cls = map[value] ?? map.Low;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${cls}`}>
      {value}
    </span>
  );
}

function StatusBadge({ approval, executionStatus }: { approval: string; executionStatus?: string }) {
  if (executionStatus === "complete") {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200/60">Implemented</span>;
  }
  if (approval === "approved") {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset bg-indigo-50 text-indigo-700 ring-indigo-200/60">Approved</span>;
  }
  if (approval === "skipped") {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset bg-slate-100 text-slate-500 ring-slate-200/60">Skipped</span>;
  }
  return null;
}

// ─── Link list item ───────────────────────────────────────────────

function LinkCard({
  change,
  selected,
  localApproval,
  onClick,
}: {
  change: Change;
  selected: boolean;
  localApproval?: string;
  onClick: () => void;
}) {
  const proposal = parseProposal(change.fields.proposed_value ?? "");
  const sourcePath = parsePath(change.fields.page_url ?? proposal?.source_url ?? "");
  const targetPath = proposal ? parsePath(proposal.target_url) : "";
  const anchor = proposal?.anchor_text ?? "";
  const confidence = change.fields.confidence ?? "";
  const effectiveApproval = localApproval ?? change.fields.approval;
  const isDone = effectiveApproval && effectiveApproval !== "pending";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${
        selected
          ? "bg-indigo-50 border-indigo-200 shadow-sm"
          : isDone
          ? "bg-slate-50 border-slate-100 opacity-60 hover:opacity-80"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {/* From path */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-mono text-slate-500 truncate leading-tight">{sourcePath}</span>
        <div className="shrink-0 flex items-center gap-1.5">
          {isDone ? (
            <StatusBadge approval={effectiveApproval} executionStatus={change.fields.execution_status} />
          ) : (
            <ConfidenceBadge value={confidence} />
          )}
        </div>
      </div>

      {/* The link itself */}
      <div className="flex items-start gap-1.5 flex-wrap">
        <svg className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span className="text-[12px] text-indigo-700 font-medium leading-snug">
          &ldquo;{anchor}&rdquo;
        </span>
      </div>

      {/* To path */}
      {targetPath && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-slate-400">→</span>
          <span className="text-[11px] font-mono text-slate-400 truncate">{targetPath}</span>
        </div>
      )}
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────

function DetailPanel({
  change,
  localApproval,
  token,
  contactEmail,
  onDecision,
  onUndo,
}: {
  change: Change;
  localApproval?: string;
  token: string;
  contactEmail: string;
  onDecision: (changeId: string, decision: "approved" | "skipped" | "question", notes?: string) => Promise<void>;
  onUndo: (changeId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [undoRemaining, setUndoRemaining] = useState<number | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset local state when change switches
  useEffect(() => {
    setFeedback(null);
    setError(null);
    setShowQuestion(false);
    setQuestionText("");
    setUndoRemaining(null);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
  }, [change.id]);

  const effectiveApproval = localApproval ?? change.fields.approval;
  const isDone = effectiveApproval && effectiveApproval !== "pending";

  const proposal = parseProposal(change.fields.proposed_value ?? "");
  const sourcePath = parsePath(change.fields.page_url ?? proposal?.source_url ?? "");
  const targetPath = proposal ? parsePath(proposal.target_url) : "";
  const anchor = proposal?.anchor_text ?? "";
  const context = proposal?.context ?? "";

  // Highlight anchor text inside context
  let contextNodes: React.ReactNode = context;
  if (context && anchor) {
    const idx = context.indexOf(anchor);
    if (idx !== -1) {
      contextNodes = (
        <>
          {context.slice(0, idx)}
          <strong className="text-indigo-800 font-semibold underline decoration-indigo-300 underline-offset-2">
            {anchor}
          </strong>
          {context.slice(idx + anchor.length)}
        </>
      );
    }
  }

  const startUndo = useCallback((changeId: string) => {
    setUndoRemaining(30);
    undoTimerRef.current = setInterval(() => {
      setUndoRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onDecision(change.id, "approved");
      setFeedback("Approved — we'll add this link within 24 hours.");
      startUndo(change.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onDecision(change.id, "skipped");
      setFeedback("Skipped — you can revisit this any time.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuestion = async () => {
    if (!questionText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDecision(change.id, "question", questionText.trim());
      setFeedback(`Question submitted — we'll reply within 1 business day at ${contactEmail}.`);
      setShowQuestion(false);
      setQuestionText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = async () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setUndoRemaining(null);
    setSubmitting(true);
    try {
      await onUndo(change.id);
      setFeedback(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-2 mb-3">
          <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <h3 className="text-[14px] font-semibold text-slate-900 leading-snug">
            {change.fields.change_title || "Internal Link Recommendation"}
          </h3>
        </div>

        {/* From → To visual */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 space-y-1.5 font-mono text-[12px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider w-10 shrink-0">From</span>
            <span className="text-slate-700 truncate">{sourcePath}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider w-10 shrink-0">Link</span>
            <span className="text-indigo-600 font-sans font-medium truncate">&ldquo;{anchor}&rdquo;</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider w-10 shrink-0">To</span>
            <span className="text-slate-700 truncate">{targetPath || proposal?.target_url}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-5 space-y-5">
        {/* Context */}
        {context && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Where it goes in the page</div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-[13px] text-slate-700 leading-relaxed italic">
                &ldquo;{contextNodes}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Why we recommend it */}
        {change.fields.plain_english_explanation && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Why we recommend this</div>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {change.fields.plain_english_explanation}
            </p>
          </div>
        )}

        {/* Business impact */}
        {change.fields.business_impact_explanation && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Business impact</div>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {change.fields.business_impact_explanation}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 pt-4 border-t border-slate-100 space-y-3">
        {/* Feedback / error */}
        {feedback && (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <p className="text-[12px] text-emerald-700">{feedback}</p>
            {undoRemaining !== null && (
              <button
                onClick={handleUndo}
                disabled={submitting}
                className="text-[11px] font-semibold text-emerald-700 underline hover:no-underline shrink-0"
              >
                Undo ({undoRemaining}s)
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <p className="text-[12px] text-red-700">{error}</p>
          </div>
        )}

        {isDone && !feedback ? (
          <div className="text-center py-2">
            <StatusBadge approval={effectiveApproval} executionStatus={change.fields.execution_status} />
          </div>
        ) : !isDone ? (
          <>
            {showQuestion ? (
              <div className="space-y-2">
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="What would you like to know about this recommendation?"
                  className="w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2.5 resize-none text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  rows={3}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleQuestion}
                    disabled={submitting || !questionText.trim()}
                    className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-[13px] font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    Send question
                  </button>
                  <button
                    onClick={() => { setShowQuestion(false); setQuestionText(""); }}
                    className="px-3 py-2 rounded-xl text-[13px] text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {submitting ? "Approving…" : "Add this link"}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => setShowQuestion(true)}
                  disabled={submitting}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  title="Ask a question"
                >
                  ?
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────

export function InternalLinksView({
  pending,
  decided,
  pkg,
  monthlyTarget,
  implementedCount,
  token,
  contactEmail,
}: InternalLinksViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(pending[0]?.id ?? decided[0]?.id ?? null);
  const [localDecisions, setLocalDecisions] = useState<Map<string, string>>(new Map());
  const [showHistory, setShowHistory] = useState(false);

  const allChanges = showHistory ? [...pending, ...decided] : pending;
  const selected = [...pending, ...decided].find((c) => c.id === selectedId) ?? null;

  const pct = monthlyTarget === 0 ? 100 : Math.min(100, Math.round((implementedCount / monthlyTarget) * 100));
  const done = implementedCount >= monthlyTarget;
  const pendingCount = pending.length;

  const pkgBadge: Record<PackageTier, string> = {
    starter: "bg-slate-100 text-slate-600",
    growth: "bg-indigo-50 text-indigo-700",
    authority: "bg-violet-50 text-violet-700",
  };

  const applyDecision = useCallback(async (
    changeId: string,
    decision: "approved" | "skipped" | "question",
    notes?: string
  ) => {
    const res = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: changeId, decision, notes, token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status}`);
    }
    setLocalDecisions((prev) => new Map(prev).set(changeId, decision));

    // Auto-advance to next pending item
    if (decision !== "question") {
      const currentIdx = pending.findIndex((c) => c.id === changeId);
      const next = pending.find((c, i) => i > currentIdx && !localDecisions.has(c.id) && c.id !== changeId);
      if (next) {
        setTimeout(() => setSelectedId(next.id), decision === "skipped" ? 800 : 1800);
      }
    }
  }, [token, pending, localDecisions]);

  const applyUndo = useCallback(async (changeId: string) => {
    const res = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: changeId, decision: "undo", token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Undo failed`);
    }
    setLocalDecisions((prev) => {
      const next = new Map(prev);
      next.delete(changeId);
      return next;
    });
  }, [token]);

  const isEmpty = pending.length === 0 && decided.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Internal Links</h1>
        <p className="text-base text-slate-500 mt-1">
          Connect related pages across your site to build topical authority.
        </p>
      </div>

      {/* Quota bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-600">
                Links implemented this month
              </span>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60">
                    {pendingCount} pending
                  </span>
                )}
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pkgBadge[pkg]}`}>
                  {PACKAGE_LABELS[pkg]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-indigo-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-[13px] font-semibold tabular-nums shrink-0 ${done ? "text-emerald-600" : "text-slate-700"}`}>
                {implementedCount} / {monthlyTarget}
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
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800 mb-2">No link recommendations yet</h3>
          <p className="text-[13px] text-slate-400 max-w-sm mx-auto leading-relaxed">
            We scan your site monthly and generate internal link recommendations based on your keyword research.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] overflow-hidden flex h-[calc(100vh-22rem)] min-h-[480px]">
          {/* Left: list */}
          <div className="w-[300px] shrink-0 border-r border-slate-100 flex flex-col">
            {/* List header */}
            <div className="px-3 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-700">
                {showHistory ? "All links" : `${pendingCount} to review`}
              </span>
              {decided.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showHistory ? "Hide history" : `+ ${decided.length} done`}
                </button>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {allChanges.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No items</p>
              ) : (
                allChanges.map((c) => (
                  <LinkCard
                    key={c.id}
                    change={c}
                    selected={c.id === selectedId}
                    localApproval={localDecisions.get(c.id)}
                    onClick={() => setSelectedId(c.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <DetailPanel
                key={selected.id}
                change={selected}
                localApproval={localDecisions.get(selected.id)}
                token={token}
                contactEmail={contactEmail}
                onDecision={applyDecision}
                onUndo={applyUndo}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">
                Select a recommendation to review it
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
