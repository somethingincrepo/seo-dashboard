"use client";

interface ApprovalActionBarProps {
  changeId: string;
  approval: string;
  approvedAt?: string;
  implementedAt?: string;
  submitting: boolean;
  feedback: string | null;
  error: string | null;
  confirmApprove: boolean;
  undoTarget: { changeId: string; remaining: number } | null;
  isLocalDecision: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onQuestion: () => void;
  onConfirmApprove: () => void;
  onCancelConfirm: () => void;
  onUndo: (changeId: string) => void;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ApprovalActionBar({
  changeId,
  approval,
  approvedAt,
  implementedAt,
  submitting,
  feedback,
  error,
  confirmApprove,
  undoTarget,
  isLocalDecision,
  onApprove,
  onSkip,
  onQuestion,
  onConfirmApprove,
  onCancelConfirm,
  onUndo,
}: ApprovalActionBarProps) {
  const canUndo =
    undoTarget &&
    undoTarget.changeId === changeId &&
    undoTarget.remaining > 0;

  if (canUndo) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-emerald-300">
            Approved &mdash; we&apos;ll implement this within 24 hours.
          </span>
          <button
            onClick={() => onUndo(changeId)}
            disabled={submitting}
            className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            Undo
          </button>
        </div>
        <div className="w-full h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400/40 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(undoTarget!.remaining / 30) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-white/20">
          {undoTarget!.remaining}s
        </span>
      </div>
    );
  }

  if (feedback) {
    return (
      <div className="text-sm text-emerald-300 py-2 text-center">
        {feedback}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-300 py-2 text-center">{error}</div>
    );
  }

  if (!isLocalDecision && approval !== "pending") {
    if (approval === "approved") {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-sm text-white/40">
            You approved this on {formatDate(approvedAt || "")}.
          </span>
          {!implementedAt && (
            <button
              onClick={() => onUndo(changeId)}
              disabled={submitting}
              className="text-xs text-white/30 hover:text-red-300 underline underline-offset-2 transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      );
    }
    if (approval === "skipped") {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-sm text-white/40">You skipped this.</span>
          {!implementedAt && (
            <button
              onClick={() => onUndo(changeId)}
              disabled={submitting}
              className="text-xs text-white/30 hover:text-red-300 underline underline-offset-2 transition-colors"
            >
              Unskip
            </button>
          )}
        </div>
      );
    }
    if (approval === "question") {
      return (
        <div className="text-sm text-white/40 py-2">
          Question pending &mdash; submitted{" "}
          {formatDate(approvedAt || "")}.
        </div>
      );
    }
  }

  if (confirmApprove) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-white/60 text-center">
          Are you sure you want to approve this change?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirmApprove}
            disabled={submitting}
            className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-emerald-500/20 border border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/30 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Yes, approve
          </button>
          <button
            onClick={onCancelConfirm}
            disabled={submitting}
            className="flex-[2] py-3 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] hover:text-white/60 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onApprove}
        disabled={submitting}
        className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-emerald-500/20 border border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/30 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ✓ Approve
      </button>
      <button
        onClick={onSkip}
        disabled={submitting}
        className="flex-[2] py-3 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] hover:text-white/60 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        — Skip
      </button>
      <button
        onClick={onQuestion}
        disabled={submitting}
        className="w-12 py-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-400/20 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ?
      </button>
    </div>
  );
}
