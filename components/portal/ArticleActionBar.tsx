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
        <span className="text-emerald-400 text-sm font-medium">{feedback}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  if (isDecided) {
    return (
      <div className="flex items-center gap-2 py-3">
        {portalApproval === "approved" ? (
          <span className="text-emerald-400 text-sm font-medium">✓ Approved for publishing</span>
        ) : (
          <span className="text-amber-400 text-sm font-medium">↩ Revision requested</span>
        )}
      </div>
    );
  }

  if (showRevisionInput) {
    return (
      <div className="space-y-3">
        <label className="text-[11px] font-bold uppercase tracking-widest text-white/25 block">
          What would you like revised?
        </label>
        <textarea
          value={revisionNotes}
          onChange={(e) => setRevisionNotes(e.target.value)}
          placeholder="Describe the changes you'd like us to make..."
          className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40 resize-none"
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
            className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-sm text-amber-300 hover:bg-amber-500/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending..." : "Send revision request"}
          </button>
          <button
            onClick={() => { setShowRevisionInput(false); setRevisionNotes(""); }}
            className="px-3 py-2 text-sm text-white/30 hover:text-white/50 transition-colors"
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
        className="px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Approving..." : "Approve to Publish"}
      </button>
      <button
        onClick={() => setShowRevisionInput(true)}
        disabled={submitting}
        className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Request Revision
      </button>
    </div>
  );
}
