"use client";

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { Change } from "@/lib/changes";

interface ChangeCardProps {
  change: Change;
  token: string;
}

type Decision = "approved" | "skipped" | "question" | null;

export function ChangeCard({ change: initialChange, token }: ChangeCardProps) {
  const f = initialChange.fields;
  const [decision, setDecision] = useState<Decision>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submitDecision(d: "approved" | "skipped" | "question", notes?: string) {
    setLoading(true);
    setDecision(d);
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: initialChange.id,
          decision: d,
          notes,
          token,
        }),
      });
      setSubmitted(true);
    } catch {
      setDecision(null);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="glass rounded-2xl p-5 opacity-60">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700">
            {decision === "approved" && "✓ Approved"}
            {decision === "skipped" && "— Skipped"}
            {decision === "question" && "? Question submitted"}
          </span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-slate-400 text-xs">{f.type}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <StatusBadge value={f.cat} variant="category" />
              <span className="text-sm font-medium text-slate-700">{f.type}</span>
              <StatusBadge value={f.confidence} variant="confidence" />
              {f.is_nav_page && (
                <span className="text-xs text-amber-700 border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  Nav page
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Proposed value */}
        {f.proposed_value && (
          <div className="mb-3">
            {f.current_value && (
              <div className="mb-2">
                <div className="text-xs text-slate-400 mb-1">Current</div>
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 line-clamp-2 border border-slate-200">
                  {f.current_value}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-400 mb-1">Proposed</div>
              <div className="text-xs text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-200">
                {f.proposed_value}
              </div>
            </div>
          </div>
        )}

        {/* Reasoning toggle */}
        {f.reasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            {showReasoning ? "▲ Hide" : "▼ Why this change"}
          </button>
        )}
        {showReasoning && f.reasoning && (
          <div className="text-xs text-slate-500 leading-relaxed mb-3 pl-3 border-l border-slate-200">
            {f.reasoning}
          </div>
        )}

        {/* Question input */}
        {showQuestion && (
          <div className="mb-3 space-y-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's your question about this change?"
              rows={3}
              className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 resize-none transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={() => submitDecision("question", question)}
                disabled={!question.trim() || loading}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-all"
              >
                Submit question
              </button>
              <button
                onClick={() => { setShowQuestion(false); setQuestion(""); }}
                className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => submitDecision("approved")}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-40 transition-all"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => submitDecision("skipped")}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 active:scale-95 disabled:opacity-40 transition-all"
          >
            — Skip
          </button>
          <button
            onClick={() => setShowQuestion(!showQuestion)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 active:scale-95 disabled:opacity-40 transition-all"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
}
