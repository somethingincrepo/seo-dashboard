"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SubkeywordPreview = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  priority: string;
};

type GroupPreview = {
  group: string;
  description: string;
  subkeywords: SubkeywordPreview[];
};

function formatVolume(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v > 0 ? String(v) : "—";
}

export function GenerateKeywordGroups({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    if (!suggestion.trim()) return;
    setGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/portal/keywords/generate?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion }),
      });
      const data = await res.json() as { group?: GroupPreview; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || "Generation failed");
      } else {
        setPreview(data.group ?? null);
      }
    } catch {
      setError("Failed to generate keyword group");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/keywords/generate?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ save: true, group: preview }),
      });
      if (!res.ok) throw new Error("Save failed");
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setSuggestion("");
        setPreview(null);
        setDone(false);
        router.refresh();
      }, 1200);
    } catch {
      setError("Failed to save group");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
      >
        <span className="text-[15px]">✦</span>
        Generate keyword group with AI
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-indigo-50 flex items-center justify-between bg-indigo-50/50">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900">Generate keyword group</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Describe a topic area — AI will build one group with 5 keywords and real volume data</p>
        </div>
        <button onClick={() => { setOpen(false); setPreview(null); setSuggestion(""); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Input */}
        {!preview && (
          <>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleGenerate(); } }}
              placeholder="e.g. We want to target patients considering dental implants — focus on recovery, cost, and what to expect…"
              rows={4}
              className="w-full text-[13px] text-slate-700 border border-slate-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder-slate-300"
              autoFocus
            />
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleGenerate()}
                disabled={!suggestion.trim() || generating}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
              >
                {generating ? "Generating…" : "Generate group"}
              </button>
              {generating && <p className="text-[12px] text-slate-400 animate-pulse">Researching keywords…</p>}
            </div>
          </>
        )}

        {/* Preview — single group */}
        {preview && (
          <>
            <p className="text-[12px] text-slate-500">
              Review the group below. Click <strong>Add group</strong> to save it to your keywords.
            </p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-[13px] font-semibold text-slate-900">{preview.group}</p>
                {preview.description && <p className="text-[11px] text-slate-400 mt-0.5">{preview.description}</p>}
              </div>
              <div className="divide-y divide-slate-100">
                {preview.subkeywords.map((sk, i) => (
                  <div key={sk.keyword} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${
                        sk.priority === "high" ? "bg-indigo-100 text-indigo-700" :
                        sk.priority === "medium" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-slate-800 font-medium truncate">{sk.keyword}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {sk.volume > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-medium tabular-nums">
                          {formatVolume(sk.volume)}/mo
                        </span>
                      )}
                      {sk.difficulty > 0 && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold tabular-nums ${sk.difficulty < 30 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : sk.difficulty < 50 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                          KD {sk.difficulty}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 capitalize">
                        {sk.intent}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleSave()}
                disabled={saving || done}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {done ? "Added!" : saving ? "Saving…" : "Add group"}
              </button>
              <button
                onClick={() => { setPreview(null); setError(null); }}
                className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                Regenerate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
