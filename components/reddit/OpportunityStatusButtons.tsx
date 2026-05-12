"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  clientId: string;
  currentStatus: "new" | "viewed" | "replied" | "dismissed";
  apiPath?: string; // defaults to /api/reddit/opportunities
};

const LABEL: Record<string, string> = {
  viewed: "Mark Viewed",
  replied: "Replied",
  dismissed: "Dismiss",
};

const ACTIVE_STYLE: Record<string, string> = {
  viewed: "bg-slate-900 text-white border-slate-900",
  replied: "bg-emerald-600 text-white border-emerald-600",
  dismissed: "bg-red-100 text-red-600 border-red-200",
};

export function OpportunityStatusButtons({ id, clientId, currentStatus, apiPath }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);

  const api = apiPath ?? "/api/reddit/opportunities";

  async function setOpportunityStatus(next: "viewed" | "replied" | "dismissed") {
    if (next === status || pending) return;
    setPending(next);
    try {
      const body: Record<string, string> = { id, status: next };
      if (!apiPath) body.clientId = clientId; // admin route needs clientId in body
      await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(next);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (status === "dismissed") {
    return (
      <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-2 py-0.5">
        dismissed
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(["viewed", "replied", "dismissed"] as const).map((s) => (
        <button
          key={s}
          onClick={() => setOpportunityStatus(s)}
          disabled={!!pending}
          className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer disabled:opacity-60 ${
            status === s
              ? ACTIVE_STYLE[s]
              : "text-slate-500 border-slate-200 hover:border-slate-400 bg-white"
          }`}
        >
          {pending === s ? "…" : LABEL[s]}
        </button>
      ))}
    </div>
  );
}
