"use client";

import { useState } from "react";

interface Props {
  clientId: string;
  companyName: string;
}

export function TriggerAuditButton({ clientId, companyName }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" | "warn" } | null>(null);

  async function trigger() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, triggered_by: "scheduled" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setMessage({ text: "Audit already in progress", tone: "warn" });
      } else if (!res.ok) {
        setMessage({ text: data.error ?? `Failed (${res.status})`, tone: "err" });
      } else {
        setMessage({ text: `Audit queued for ${companyName}`, tone: "ok" });
      }
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="text-xs px-3 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 font-medium"
      >
        {busy ? "Triggering…" : "Run audit now"}
      </button>
      {message && (
        <span className={`text-[10px] ${
          message.tone === "ok" ? "text-green-600" :
          message.tone === "warn" ? "text-amber-600" :
          "text-red-500"
        }`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
