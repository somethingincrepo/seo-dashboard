"use client";
import { useState, createContext, useContext, useCallback } from "react";

interface ApprovalProgressProps {
  total: number;
}

interface ApprovalProgressContextValue {
  total: number;
  reviewed: number;
  markReviewed: () => void;
}

const ApprovalProgressContext = createContext<ApprovalProgressContextValue>({
  total: 0,
  reviewed: 0,
  markReviewed: () => {},
});

export function useApprovalProgress() {
  return useContext(ApprovalProgressContext);
}

export function ApprovalProgressProvider({ total, children }: { total: number; children: React.ReactNode }) {
  const [reviewed, setReviewed] = useState(0);
  const markReviewed = useCallback(() => setReviewed((p) => p + 1), []);
  return (
    <ApprovalProgressContext.Provider value={{ total, reviewed, markReviewed }}>
      {children}
    </ApprovalProgressContext.Provider>
  );
}

export function ApprovalProgress({ total }: ApprovalProgressProps) {
  const { reviewed } = useContext(ApprovalProgressContext);
  if (total === 0) return null;

  const pct = Math.round((reviewed / total) * 100);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-white/40">
        <span className="text-white/70 font-medium">{reviewed}</span>
        <span className="text-white/20"> / </span>
        <span className="text-white/70 font-medium">{total}</span>
        <span className="text-white/20 ml-1">reviewed</span>
      </span>
      <div className="w-20 h-1 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full bg-violet-400/60 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
