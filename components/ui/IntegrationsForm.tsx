"use client";

import { useState } from "react";

interface Props {
  clientId: string;
  initialValues: {
    gsc_property: string;
    ga4_property: string;
    sheet_id: string;
    drive_folder_id: string;
  };
}

export function IntegrationsForm({ clientId, initialValues }: Props) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof typeof values; label: string; placeholder: string }[] = [
    { key: "gsc_property", label: "GSC Property", placeholder: "sc-domain:example.com" },
    { key: "ga4_property", label: "GA4 Property ID", placeholder: "123456789" },
    { key: "sheet_id", label: "Google Sheet ID", placeholder: "1BxiMVs0..." },
    { key: "drive_folder_id", label: "Drive Folder ID", placeholder: "1BxiMVs0..." },
  ];

  return (
    <div className="space-y-3">
      {fields.map(({ key, label, placeholder }) => (
        <div key={key} className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-36 shrink-0">{label}</label>
          <input
            type="text"
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            placeholder={placeholder}
            className="flex-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
      ))}
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
