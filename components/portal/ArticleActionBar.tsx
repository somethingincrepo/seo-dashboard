"use client";

import { useState } from "react";
import type { ArticleDecision } from "./useArticleActions";

interface ArticleActionBarProps {
  resultId: string;
  portalApproval: string | null;
  submitting: boolean;
  feedback: string | null;
  error: string | null;
  onApprove: () => void;
  onRequestRevision: (notes: string) => void;
}

export function ArticleActionBar({
  portalApproval,
  submitting,
  feedback,
  error,
  onApprove,
  onRequestRevision,
}: ArticleActionBarProps) {
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  const isDecided = portalApproval === "approved" || portalApproval === "needs_revision";

  if (feedback) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-emerald-600 text-sm font-medium">{feedback}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-red-600 text-sm">{error}</span>
      </div>
    );
  }

  if (isDecided) {
    return (
      <div className="flex items-center gap-2 py-3">
        {portalApproval === "approved" ? (
          <span className="text-emerald-600 text-sm font-medium">✓ Approved for publishing</span>
        ) : (
          <span className="text-amber-600 text-sm font-medium">↩ Revision requested</span>
        )}
      </div>
    );
  }

  if (showRevisionInput) {
    return (
      <div className="space-y-3">
        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block">
          What would you like revised?
        </label>
        <textarea
          value={revisionNotes}
          onChange={(e) => setRevisionNotes(e.target.value)}
          placeholder="Describe the changes you'd like us to make..."
          className="w-full h-24 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 resize-none"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (revisionNotes.trim()) {
                onRequestRevision(revisionNotes.trim());
                setShowRevisionInput(false);
                setRevisionNotes("");
              }
            }}
            disabled={!revisionNotes.trim() || submitting}
            className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 hover:bg-amber-100 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending..." : "Send revision request"}
          </button>
          <button
            onClick={() => { setShowRevisionInput(false); setRevisionNotes(""); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onApprove}
        disabled={submitting}
        className="px-5 py-2.5 rounded-xl bg-emerald-600 border border-emerald-700 text-sm font-medium text-white hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Approving..." : "Approve to Publish"}
      </button>
      <button
        onClick={() => setShowRevisionInput(true)}
        disabled={submitting}
        className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Request Revision
      </button>
    </div>
  );
}
