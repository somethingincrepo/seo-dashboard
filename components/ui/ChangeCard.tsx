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
          <span className="text-sm">
            {decision === "approved" && "✓ Approved"}
            {decision === "skipped" && "— Skipped"}
            {decision === "question" && "? Question submitted"}
          </span>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/40 text-xs">{f.type}</span>
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
              <span className="text-sm font-medium text-white/80">{f.type}</span>
              <StatusBadge value={f.confidence} variant="confidence" />
              {f.is_nav_page && (
                <span className="text-xs text-amber-400/70 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
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
                <div className="text-xs text-white/30 mb-1">Current</div>
                <div className="text-xs text-white/50 bg-white/5 rounded-lg px-3 py-2 line-clamp-2 border border-white/8">
                  {f.current_value}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-white/30 mb-1">Proposed</div>
              <div className="text-xs text-white/80 bg-violet-500/10 rounded-lg px-3 py-2 border border-violet-400/15">
                {f.proposed_value}
              </div>
            </div>
          </div>
        )}

        {/* Reasoning toggle */}
        {f.reasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-xs text-white/30 hover:text-white/50 transition-colors mb-3"
          >
            {showReasoning ? "▲ Hide" : "▼ Why this change"}
          </button>
        )}
        {showReasoning && f.reasoning && (
          <div className="text-xs text-white/50 leading-relaxed mb-3 pl-3 border-l border-white/10">
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
              className="w-full text-xs px-3 py-2 rounded-xl bg-white/6 border border-white/12 text-white placeholder-white/25 focus:outline-none focus:border-white/25 resize-none transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={() => submitDecision("question", question)}
                disabled={!question.trim() || loading}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-40 transition-all"
              >
                Submit question
              </button>
              <button
                onClick={() => { setShowQuestion(false); setQuestion(""); }}
                className="text-xs px-3 py-1.5 rounded-lg text-white/30 hover:text-white/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/8">
          <button
            onClick={() => submitDecision("approved")}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-emerald-500/20 border border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/30 active:scale-95 disabled:opacity-40 transition-all"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => submitDecision("skipped")}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-white/6 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 active:scale-95 disabled:opacity-40 transition-all"
          >
            — Skip
          </button>
          <button
            onClick={() => setShowQuestion(!showQuestion)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/6 border border-white/10 text-white/50 hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-400/20 active:scale-95 disabled:opacity-40 transition-all"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
}
