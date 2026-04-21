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
  const [gscNotice, setGscNotice] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    setGscNotice(null);
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
      const data = await res.json();

      // If the GSC property was auto-corrected to an accessible format, update the UI
      if (data.gsc_auto_corrected) {
        setValues((v) => ({ ...v, gsc_property: data.gsc_auto_corrected.resolved }));
        setGscNotice(
          `Auto-corrected: "${data.gsc_auto_corrected.original}" → "${data.gsc_auto_corrected.resolved}"`
        );
      } else if (data.gsc_property) {
        setValues((v) => ({ ...v, gsc_property: data.gsc_property }));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof typeof values; label: string; placeholder: string; hint?: string }[] = [
    {
      key: "gsc_property",
      label: "GSC Property",
      placeholder: "https://example.com/ or sc-domain:example.com",
      hint: "Use the URL shown in Search Console. Both formats work — the system auto-detects the accessible one.",
    },
    { key: "ga4_property", label: "GA4 Property ID", placeholder: "123456789" },
    { key: "sheet_id", label: "Google Sheet ID", placeholder: "1BxiMVs0..." },
    { key: "drive_folder_id", label: "Drive Folder ID", placeholder: "1BxiMVs0..." },
  ];

  return (
    <div className="space-y-3">
      {fields.map(({ key, label, placeholder, hint }) => (
        <div key={key}>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 w-36 shrink-0">{label}</label>
            <input
              type="text"
              value={values[key]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [key]: e.target.value }));
                if (key === "gsc_property") setGscNotice(null);
              }}
              placeholder={placeholder}
              className="flex-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            />
          </div>
          {hint && key === "gsc_property" && (
            <div className="ml-36 pl-3 mt-0.5 text-[10px] text-slate-400">{hint}</div>
          )}
        </div>
      ))}

      {gscNotice && (
        <div className="ml-36 pl-3">
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 font-mono">
            {gscNotice}
          </div>
        </div>
      )}

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
