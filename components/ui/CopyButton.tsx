"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  size?: "sm" | "lg";
}

export function CopyButton({ value, label = "Copy", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "rounded-xl border transition-all font-medium",
        size === "lg"
          ? "px-4 py-2 text-sm"
          : "px-3 py-1.5 text-xs",
        copied
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      )}
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
