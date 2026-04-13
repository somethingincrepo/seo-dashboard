"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  changeId: string;
  clientId: string;
}

export function DesignReviewActions({ changeId, clientId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"safe" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(decision: "safe" | "manual") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/design-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId, decision, clientId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      setDone(decision);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done === "safe") {
    return (
      <div className="text-sm text-emerald-700 font-medium">
        Queued for implementation
      </div>
    );
  }

  if (done === "manual") {
    return (
      <div className="text-sm text-slate-500">
        Marked as manual implementation required
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={() => act("safe")}
        disabled={submitting}
        className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        Safe to implement
      </button>
      <button
        onClick={() => act("manual")}
        disabled={submitting}
        className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        Mark manual
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
