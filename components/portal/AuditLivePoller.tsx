"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  token: string;
  initialCount: number;
}

export function AuditLivePoller({ token, initialCount }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [display, setDisplay] = useState(initialCount);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`/api/portal/audit-status?token=${encodeURIComponent(token)}`);
        if (!r.ok) return;
        const data = (await r.json()) as { status: string; pages_crawled: number };
        if (typeof data.pages_crawled === "number") setCount(data.pages_crawled);
        if (data.status === "complete" || data.status === "failed") router.refresh();
      } catch {}
    };

    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [token, router]);

  // Smooth counter animation
  useEffect(() => {
    if (count === display) return;
    const diff = count - display;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 15));
    const id = setInterval(() => {
      setDisplay((n) => {
        const next = n + (diff > 0 ? step : -step);
        if ((diff > 0 && next >= count) || (diff < 0 && next <= count)) {
          clearInterval(id);
          return count;
        }
        return next;
      });
    }, 40);
    return () => clearInterval(id);
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-3 space-y-3">
      {/* Spinner + label */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-5 h-5 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
        <span className="text-sm font-semibold text-slate-600">Audit in progress</span>
      </div>

      {/* Live page count */}
      {count > 0 && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-indigo-600 transition-all duration-300">
            {display.toLocaleString()}
          </span>
          <span className="text-xs text-indigo-400 font-medium">pages scanned</span>
        </div>
      )}

      {/* Shimmer progress bar */}
      <div className="h-1 rounded-full bg-indigo-100 overflow-hidden">
        <div
          className="h-full w-1/3 rounded-full bg-indigo-400"
          style={{ animation: "auditShimmer 1.6s ease-in-out infinite" }}
        />
      </div>

      <style>{`
        @keyframes auditShimmer {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(450%); }
        }
      `}</style>
    </div>
  );
}
