"use client";

import { useState } from "react";

interface Props {
  clientId: string;
  initialValues: {
    is_local_business: boolean;
    service_areas: string;
  };
}

export function LocalSeoForm({ clientId, initialValues }: Props) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/local-seo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-36 shrink-0">Local business</label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={values.is_local_business}
            onChange={(e) => setValues((v) => ({ ...v, is_local_business: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Serves a defined geographic area (city / region / service area)</span>
        </label>
      </div>
      <div className="ml-36 pl-3 -mt-1 text-[10px] text-slate-400">
        When checked, title generation produces a mix of geo-targeted and topic-only titles using the service areas below.
      </div>

      <div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-36 shrink-0">Service areas</label>
          <input
            type="text"
            value={values.service_areas}
            onChange={(e) => setValues((v) => ({ ...v, service_areas: e.target.value }))}
            placeholder="Austin, Round Rock, Cedar Park"
            className="flex-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
        <div className="ml-36 pl-3 mt-0.5 text-[10px] text-slate-400">
          Comma-separated cities or regions. Used as real place names in geo-targeted titles. Leave empty to fall back to topic-only titles.
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
