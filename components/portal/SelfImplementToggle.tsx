"use client";

import { useState } from "react";

interface SelfImplementToggleProps {
  changeId: string;
  token: string;
  initialValue?: boolean;
  // Called after the API call succeeds — the parent should re-render with the new value.
  onChange?: (value: boolean) => void;
  // If true, hides the toggle (e.g. when the client is already manual mode and there's nothing to opt out of).
  hidden?: boolean;
}

export function SelfImplementToggle({
  changeId,
  token,
  initialValue = false,
  onChange,
  hidden,
}: SelfImplementToggleProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  if (hidden) return null;

  async function handleToggle() {
    const next = !value;
    setSubmitting(true);
    try {
      const res = await fetch("/api/changes/self-implement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: changeId, value: next, token }),
      });
      if (!res.ok) throw new Error("Failed to update preference");
      setValue(next);
      onChange?.(next);
    } catch {
      // silently revert; the parent can show a toast if it wants
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        disabled={submitting}
        onChange={handleToggle}
        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span>I&apos;ll implement this myself</span>
    </label>
  );
}
