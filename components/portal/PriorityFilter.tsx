"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PRIORITIES = ["All", "Critical", "High", "Medium", "Low"] as const;

export function PriorityFilterWrapper() {
  return (
    <Suspense fallback={<div className="text-xs text-white/30">Filter by priority:</div>}>
      <PriorityFilter />
    </Suspense>
  );
}

function PriorityFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("priority") || "All";

  const setPriority = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "All") {
        params.delete("priority");
      } else {
        params.set("priority", value);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/30 mr-1">Filter by priority:</span>
      {PRIORITIES.map((p) => (
        <button
          key={p}
          onClick={() => setPriority(p)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
            current === p
              ? "bg-violet-500/20 border border-violet-400/30 text-violet-300"
              : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 hover:bg-white/[0.06]"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
