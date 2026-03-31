"use client";
import { useState } from "react";
import { ChangeCard } from "@/components/ui/ChangeCard";
import type { Change } from "@/lib/changes";

interface CollapsiblePageGroupProps {
  page: string;
  changes: Change[];
  token: string;
  defaultOpen?: boolean;
}

export function CollapsiblePageGroup({ page, changes, token, defaultOpen = true }: CollapsiblePageGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  let displayPage = page;
  try {
    const url = new URL(page);
    displayPage = url.pathname === "/" ? url.hostname : url.pathname;
  } catch { /* not a URL */ }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/4 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white/30 text-xs">{open ? "\u25BC" : "\u25B6"}</span>
          <span className="text-xs font-mono text-white/60 truncate">{displayPage}</span>
        </div>
        <span className="text-xs text-white/30 flex-shrink-0 ml-3">
          {changes.length} change{changes.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Changes */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-4">
          {changes.map((change) => (
            <ChangeCard key={change.id} change={change} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
