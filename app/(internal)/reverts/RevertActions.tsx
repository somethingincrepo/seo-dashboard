"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  changeId: string;
  executionStatus: "complete" | "reverting" | "reverted" | "revert_failed";
  hasRevertPayload: boolean;
}

export function RevertActions({ changeId, executionStatus, hasRevertPayload }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"revert" | "requeue" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(executionStatus);

  async function triggerRevert() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      setLocalStatus("reverting");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setConfirming(null);
    }
  }

  async function triggerRequeue() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reset-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setConfirming(null);
    }
  }

  if (localStatus === "reverting") {
    return (
      <div className="text-xs text-amber-700 font-medium italic">
        Revert in progress — worker is restoring the original state…
      </div>
    );
  }

  if (localStatus === "reverted") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500">Reverted successfully.</span>
        {confirming === "requeue" ? (
          <>
            <span className="text-xs text-slate-600">Re-queue this change for implementation?</span>
            <button
              onClick={triggerRequeue}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Re-queuing…" : "Yes, re-queue"}
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming("requeue")}
            className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Re-queue for implementation
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  if (localStatus === "revert_failed") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-red-600 font-medium">Revert failed.</span>
        {confirming === "revert" ? (
          <>
            <span className="text-xs text-slate-600">Retry the revert?</span>
            <button
              onClick={triggerRevert}
              disabled={submitting || !hasRevertPayload}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Reverting…" : "Retry revert"}
            </button>
            <button onClick={() => setConfirming(null)} disabled={submitting} className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
          </>
        ) : confirming === "requeue" ? (
          <>
            <span className="text-xs text-slate-600">Reset and re-queue for a fresh implementation attempt?</span>
            <button
              onClick={triggerRequeue}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Resetting…" : "Reset & re-queue"}
            </button>
            <button onClick={() => setConfirming(null)} disabled={submitting} className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
          </>
        ) : (
          <>
            {hasRevertPayload && (
              <button
                onClick={() => setConfirming("revert")}
                className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Retry revert
              </button>
            )}
            <button
              onClick={() => setConfirming("requeue")}
              className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset & re-queue
            </button>
          </>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  // executionStatus === "complete"
  if (!hasRevertPayload) {
    return (
      <div className="text-xs text-slate-400 italic">
        No revert data — implemented before revert system. Manual revert required.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {confirming === "revert" ? (
        <>
          <span className="text-xs text-slate-600">This will restore the original value on the live site. Confirm?</span>
          <button
            onClick={triggerRevert}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Reverting…" : "Yes, revert"}
          </button>
          <button
            onClick={() => setConfirming(null)}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirming("revert")}
          className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Revert change
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
