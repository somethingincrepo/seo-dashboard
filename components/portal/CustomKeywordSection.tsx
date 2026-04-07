"use client";

import { useState } from "react";
import { SubkeywordRow, type Subkeyword } from "./KeywordGroups";
import { CUSTOM_STYLE } from "./keyword-styles";
import { useKeywordActions } from "./useKeywordActions";

interface CustomKeywordSectionProps {
  token: string;
  customKeywords: Subkeyword[];
  groupIndex: number;
}

export function CustomKeywordSection({ token, customKeywords, groupIndex }: CustomKeywordSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);

  const { adding, editing, removing, feedback, error, addKeyword, editKeyword, removeKeyword } =
    useKeywordActions(token);

  const handleAdd = async () => {
    const kw = inputValue.trim();
    if (!kw || adding) return;
    const ok = await addKeyword(kw);
    if (ok) setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const startEdit = (keyword: string) => {
    setEditingKeyword(keyword);
    setEditValue(keyword);
  };

  const cancelEdit = () => {
    setEditingKeyword(null);
    setEditValue("");
  };

  const saveEdit = async (oldKeyword: string) => {
    const newKw = editValue.trim();
    if (!newKw || newKw === oldKeyword) {
      cancelEdit();
      return;
    }
    const ok = await editKeyword(oldKeyword, newKw);
    if (ok) cancelEdit();
  };

  const editKeyDown = (e: React.KeyboardEvent, oldKeyword: string) => {
    if (e.key === "Enter") saveEdit(oldKeyword);
    if (e.key === "Escape") cancelEdit();
  };

  return (
    <div className={`bg-white rounded-2xl border-t-2 ${CUSTOM_STYLE.border} border border-slate-200 flex flex-col p-4 gap-3`} style={{ boxShadow: "var(--shadow-xs)" }}>
      {/* Header — matches GroupCard exactly */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${CUSTOM_STYLE.text}`}>
            Your Keywords
          </span>
          {customKeywords.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium tabular-nums ${CUSTOM_STYLE.pill}`}>
              {customKeywords.length} added
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-900 leading-snug">Client Keywords</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Add your own target keywords. They&apos;ll be enriched with search data and included in your content pipeline.
        </p>
      </div>

      {/* Feedback / error */}
      {feedback && <p className="text-xs text-teal-700">{feedback}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Keywords list */}
      <div className="space-y-1.5">
        {customKeywords.map((kw, i) => {
          if (editingKeyword === kw.keyword) {
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-indigo-200">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => editKeyDown(e, kw.keyword)}
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none placeholder:text-slate-400"
                  maxLength={100}
                />
                <button
                  onClick={() => saveEdit(kw.keyword)}
                  disabled={editing === kw.keyword}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-40"
                >
                  {editing === kw.keyword ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            );
          }

          return (
            <div key={i} className={removing === kw.keyword ? "opacity-40 pointer-events-none" : ""}>
              <SubkeywordRow
                kw={kw}
                index={i}
                onEdit={!editing ? () => startEdit(kw.keyword) : undefined}
                onRemove={!editing ? () => removeKeyword(kw.keyword) : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Add input — card footer with divider */}
      <div className={customKeywords.length > 0 ? "border-t border-slate-100 pt-3" : ""}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a keyword..."
            disabled={adding}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 disabled:opacity-40 transition-colors"
            maxLength={100}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !inputValue.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-600 border border-teal-700 text-white hover:bg-teal-700 active:scale-[0.98] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
