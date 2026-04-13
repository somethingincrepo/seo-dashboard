"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  changeId: string;
  hasRevertPayload: boolean;
}

export function RevertActions({ changeId, hasRevertPayload }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasRevertPayload) {
    return (
      <div className="text-xs text-slate-400 italic">
        No revert data — implemented before revert system. Manual revert required.
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-sm text-amber-700 font-medium">
        Revert queued — worker will restore original values
      </div>
    );
  }

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
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-600">Revert this change to its original state?</span>
        <button
          onClick={triggerRevert}
          disabled={submitting}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Reverting…" : "Yes, revert"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setConfirming(true)}
        className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
      >
        Revert change
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
