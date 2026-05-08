"use client";

import { useState } from "react";

type Sop = "refresh_scheduler" | "audit_internal_links" | "content_scheduler";

interface Props {
  clientId: string;
  companyName: string;
}

export function RefireJobButtons({ clientId, companyName }: Props) {
  const [busy, setBusy] = useState<Sop | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "err">("ok");

  async function fire(sop: Sop) {
    setBusy(sop);
    setMessage(null);
    try {
      const payload =
        sop === "refresh_scheduler"
          ? { client_id: clientId, force: true }
          : sop === "content_scheduler"
            ? { client_id: clientId, weekly_run: true, force: true }
            : { client_id: clientId };

      const res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sop_name: sop,
          client_id: clientId,
          payload,
          runner: "fly",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTone("err");
        setMessage(data.error ?? `failed (${res.status})`);
      } else {
        setTone("ok");
        setMessage(`queued ${sop} for ${companyName}`);
      }
    } catch (e) {
      setTone("err");
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => fire("refresh_scheduler")}
          className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "refresh_scheduler" ? "…" : "Re-fire refresh"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => fire("audit_internal_links")}
          className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "audit_internal_links" ? "…" : "Re-fire links"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => fire("content_scheduler")}
          className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "content_scheduler" ? "…" : "Re-fire titles"}
        </button>
      </div>
      {message && (
        <span className={`text-[10px] ${tone === "ok" ? "text-green-600" : "text-red-500"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
