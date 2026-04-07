"use client";

import { useState, useRef, useEffect } from "react";
import { SubkeywordRow, type Subkeyword } from "@/components/portal/KeywordGroups";
import { useKeywordActions } from "@/components/portal/useKeywordActions";

interface CustomKeywordSectionProps {
  token: string;
  customKeywords: Subkeyword[];
}

export function CustomKeywordSection({ token, customKeywords }: CustomKeywordSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const { adding, editing, removing, feedback, error, addKeyword, editKeyword, removeKeyword, clearError } =
    useKeywordActions({ token });

  useEffect(() => {
    if (editingKeyword && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingKeyword]);

  async function handleAdd() {
    const kw = inputValue.trim();
    if (!kw || adding) return;
    const ok = await addKeyword(kw);
    if (ok) setInputValue("");
  }

  async function handleSaveEdit() {
    const newKw = editDraft.trim();
    if (!newKw || !editingKeyword || editing === editingKeyword) return;
    const ok = await editKeyword(editingKeyword, newKw);
    if (ok) setEditingKeyword(null);
  }

  function handleStartEdit(kw: string) {
    clearError();
    setEditingKeyword(kw);
    setEditDraft(kw);
  }

  function handleCancelEdit() {
    setEditingKeyword(null);
    setEditDraft("");
    clearError();
  }

  const anyEditActive = editingKeyword !== null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Add input strip ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
          Add Your Own Keywords
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); clearError(); }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. best mental health software…"
            disabled={adding}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 disabled:opacity-40 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim() || adding}
            className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 border border-teal-700 text-white hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {feedback && <p className="text-xs text-teal-700">{feedback}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* ── Custom group card — same structure as GroupCard in KeywordGroups.tsx ── */}
      {customKeywords.length > 0 && (
        <div className="bg-white rounded-2xl border-t-2 border-t-teal-500 border border-slate-200 flex flex-col p-4 gap-3" style={{ boxShadow: "var(--shadow-xs)" }}>

          {/* Header — identical pattern to GroupCard */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
                Your Keywords
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-medium tabular-nums">
                {customKeywords.length}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 leading-snug">Custom Keywords</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Included in your content pipeline alongside your AI-generated groups.
            </p>
          </div>

          {/* Keyword rows — same structure as GroupCard subkeyword list */}
          <div className="space-y-1.5">
            {customKeywords.map((kw, i) => {
              const isThisEditing = editingKeyword === kw.keyword;
              const isThisRemoving = removing === kw.keyword;
              const isThisSaving = editing === kw.keyword;

              if (isThisEditing) {
                return (
                  <div
                    key={kw.keyword}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-indigo-200"
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none min-w-0"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editDraft.trim() || isThisSaving}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isThisSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors px-1.5 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={kw.keyword}
                  className={`transition-opacity duration-150 ${isThisRemoving ? "opacity-30 pointer-events-none" : ""}`}
                >
                  <SubkeywordRow
                    kw={kw}
                    index={i}
                    onEdit={anyEditActive ? undefined : () => handleStartEdit(kw.keyword)}
                    onRemove={anyEditActive ? undefined : () => removeKeyword(kw.keyword)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
