"use client";

interface ArticleActionBarProps {
  resultId: string;
  portalApproval: string | null;
  submitting: boolean;
  feedback: string | null;
  error: string | null;
  onApprove: () => void;
}

export function ArticleActionBar({
  portalApproval,
  submitting,
  feedback,
  error,
  onApprove,
}: ArticleActionBarProps) {
  const isApproved = portalApproval === "approved";

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

  if (isApproved) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-emerald-600 text-sm font-medium">✓ Approved for publishing</span>
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
    </div>
  );
}
