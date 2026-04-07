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
          <span className="text-sm text-emerald-700">
            Approved &mdash; we&apos;ll implement this within 24 hours.
          </span>
          <button
            onClick={() => onUndo(changeId)}
            disabled={submitting}
            className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            Undo
          </button>
        </div>
        <div className="w-full h-0.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(undoTarget!.remaining / 30) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-400">
          {undoTarget!.remaining}s
        </span>
      </div>
    );
  }

  if (feedback) {
    return (
      <div className="text-sm text-emerald-700 py-2 text-center">
        {feedback}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 py-2 text-center">{error}</div>
    );
  }

  if (!isLocalDecision && approval !== "pending") {
    if (approval === "approved") {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-sm text-slate-500">
            You approved this on {formatDate(approvedAt || "")}.
          </span>
          {!implementedAt && (
            <button
              onClick={() => onUndo(changeId)}
              disabled={submitting}
              className="text-xs text-slate-400 hover:text-red-600 underline underline-offset-2 transition-colors"
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
          <span className="text-sm text-slate-500">You skipped this.</span>
          {!implementedAt && (
            <button
              onClick={() => onUndo(changeId)}
              disabled={submitting}
              className="text-xs text-slate-400 hover:text-red-600 underline underline-offset-2 transition-colors"
            >
              Unskip
            </button>
          )}
        </div>
      );
    }
    if (approval === "question") {
      return (
        <div className="text-sm text-slate-500 py-2">
          Question pending &mdash; submitted{" "}
          {formatDate(approvedAt || "")}.
        </div>
      );
    }
  }

  if (confirmApprove) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600 text-center">
          Are you sure you want to approve this change?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirmApprove}
            disabled={submitting}
            className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Yes, approve
          </button>
          <button
            onClick={onCancelConfirm}
            disabled={submitting}
            className="flex-[2] py-3 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ✓ Approve
      </button>
      <button
        onClick={onSkip}
        disabled={submitting}
        className="flex-[2] py-3 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        — Skip
      </button>
      <button
        onClick={onQuestion}
        disabled={submitting}
        className="w-12 py-3 rounded-xl text-sm bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ?
      </button>
    </div>
  );
}
