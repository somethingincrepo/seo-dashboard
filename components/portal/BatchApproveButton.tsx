"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface BatchApproveButtonProps {
  recordIds: string[];
  token: string;
  label?: string;
  onApproved?: (ids: string[]) => void;
}

export function BatchApproveButton({ recordIds, token, label, onApproved }: BatchApproveButtonProps) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  async function handleApproveAll() {
    if (!confirm(`Approve all ${recordIds.length} changes?`)) return;
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
    onApproved?.(recordIds);
    setTimeout(() => router.refresh(), 800);
  }

  if (recordIds.length === 0) return null;

  return (
    <button
      onClick={handleApproveAll}
      disabled={state !== "idle"}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {state === "idle" && (
        <>
          <span>✓</span>
          <span>{label ?? `Approve all ${recordIds.length}`}</span>
        </>
      )}
      {state === "running" && (
        <span>Approving {progress} of {recordIds.length}…</span>
      )}
      {state === "done" && <span>✓ Done! Refreshing…</span>}
    </button>
  );
}
