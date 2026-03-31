"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface BatchApproveButtonProps {
  recordIds: string[];
  token: string;
  label?: string;
}

export function BatchApproveButton({ recordIds, token, label }: BatchApproveButtonProps) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  async function handleApproveAll() {
    if (!confirm(`Approve all ${recordIds.length} quick wins? These are safe, no-design-impact changes.`)) return;
    setState("running");
    setProgress(0);
    for (let i = 0; i < recordIds.length; i++) {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: recordIds[i], decision: "approved", token }),
      });
      setProgress(i + 1);
    }
    setState("done");
    setTimeout(() => router.refresh(), 800);
  }

  if (recordIds.length === 0) return null;

  return (
    <button
      onClick={handleApproveAll}
      disabled={state !== "idle"}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:cursor-not-allowed bg-emerald-500/20 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60"
    >
      {state === "idle" && (
        <>
          <span>✓</span>
          <span>{label ?? `Approve all ${recordIds.length} quick wins`}</span>
        </>
      )}
      {state === "running" && (
        <span>Approving {progress} of {recordIds.length}…</span>
      )}
      {state === "done" && <span>✓ Done! Refreshing…</span>}
    </button>
  );
}
