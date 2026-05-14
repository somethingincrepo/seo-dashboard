"use client";
import { useState } from "react";

interface RequeueDeliverablesButtonProps {
  clientId: string;
}

export function RequeueDeliverablesButton({ clientId }: RequeueDeliverablesButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ enqueued: number; skipped: number; sops?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRequeue() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/requeue-deliverables`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResult({ enqueued: data.enqueued, skipped: data.skipped, sops: data.sops_enqueued });
      }
    } catch {
      setError("Network error — check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleRequeue}
        disabled={loading}
        className="px-3 py-1.5 rounded-xl text-xs border transition-all disabled:opacity-40 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
      >
        {loading ? "Queuing…" : "Re-run deliverables"}
      </button>
      {result && (
        <div className="text-[11px] text-emerald-700">
          {result.enqueued > 0
            ? `Queued ${result.enqueued} SOP${result.enqueued !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} already active)` : ""}`
            : "All SOPs already active — no duplicates created"}
        </div>
      )}
      {error && <div className="text-[11px] text-rose-600">{error}</div>}
    </div>
  );
}
