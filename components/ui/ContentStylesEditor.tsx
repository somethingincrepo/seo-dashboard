"use client";

import { useState } from "react";
import { CONTENT_STYLES, type ContentStyleId } from "@/lib/content-styles";

type Props = {
  clientId: string;           // main Airtable record ID — used in the API path
  recordId: string | null;    // Content Airtable record ID — null if no content profile exists yet
  initialStyleIds: ContentStyleId[];
};

export function ContentStylesEditor({ clientId, recordId, initialStyleIds }: Props) {
  const [activeIds, setActiveIds] = useState<ContentStyleId[]>(initialStyleIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: ContentStyleId) {
    setActiveIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // max 3 styles
      return [...prev, id];
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!recordId) {
      setError("No Content Airtable record found for this client. Add the client in the Content Airtable base first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-styles/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, styleIds: activeIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const changed =
    activeIds.length !== initialStyleIds.length ||
    activeIds.some((id) => !initialStyleIds.includes(id));

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        Assign 1–3 styles that shape how Claude writes titles for this client.
        {activeIds.length >= 3 && (
          <span className="ml-2 text-amber-600 font-medium">Maximum 3 styles selected.</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CONTENT_STYLES.map((style) => {
          const isActive = activeIds.includes(style.id);
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => toggle(style.id)}
              className={`group flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all ${
                isActive
                  ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              } ${!isActive && activeIds.length >= 3 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              disabled={!isActive && activeIds.length >= 3}
              title={style.description}
            >
              <span className="text-sm font-medium leading-tight">{style.label}</span>
              <span className="text-[11px] mt-0.5 opacity-70 leading-tight max-w-[160px]">
                {style.description}
              </span>
            </button>
          );
        })}
      </div>

      {activeIds.length > 0 && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Prompt preview:</span>{" "}
          {activeIds
            .map((id) => CONTENT_STYLES.find((s) => s.id === id)?.label)
            .filter(Boolean)
            .join(" + ")}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !changed}
          className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save styles"}
        </button>
        {activeIds.length > 0 && (
          <button
            type="button"
            onClick={() => { setActiveIds([]); setSaved(false); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {!recordId && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No Content Airtable record found for &quot;{clientId}&quot;. Add a matching &quot;Client Name&quot; record in the Content Airtable base to enable content styles.
        </div>
      )}
    </div>
  );
}
