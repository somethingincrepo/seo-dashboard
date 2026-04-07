"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PRIORITIES = ["All", "Critical", "High", "Medium", "Low"] as const;

export function PriorityFilterWrapper() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400">Filter by priority:</div>}>
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
      <span className="text-xs text-slate-500 mr-1">Filter by priority:</span>
      {PRIORITIES.map((p) => (
        <button
          key={p}
          onClick={() => setPriority(p)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 border ${
            current === p
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
