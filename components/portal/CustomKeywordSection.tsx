"use client";

import { useState } from "react";
import { SubkeywordRow, type Subkeyword } from "./KeywordGroups";
import { useKeywordActions } from "./useKeywordActions";

interface CustomKeywordSectionProps {
  token: string;
  customKeywords: Subkeyword[];
}

interface CustomKeywordsCardProps {
  keywords: Subkeyword[];
  editing: string | null;
  removing: string | null;
  editValue: string;
  editingKeyword: string | null;
  setEditValue: (v: string) => void;
  startEdit: (kw: string) => void;
  cancelEdit: () => void;
  saveEdit: (oldKw: string) => Promise<void>;
  editKeyDown: (e: React.KeyboardEvent, oldKw: string) => void;
  removeKeyword: (kw: string) => Promise<boolean>;
}

function CustomKeywordsCard({
  keywords,
  editing,
  removing,
  editValue,
  editingKeyword,
  setEditValue,
  startEdit,
  cancelEdit,
  saveEdit,
  editKeyDown,
  removeKeyword,
}: CustomKeywordsCardProps) {
  keywords: Subkeyword[];
  editing: string | null;
  removing: string | null;
  editValue: string;
  editingKeyword: string | null;
  setEditValue: (v: string) => void;
  startEdit: (kw: string) => void;
  cancelEdit: () => void;
  saveEdit: (oldKw: string) => Promise<void>;
  editKeyDown: (e: React.KeyboardEvent, oldKw: string) => void;
}) {
  return (
    <div className="bg-white/[0.03] rounded-2xl border-t-2 border-t-teal-500 border border-white/[0.06] flex flex-col p-4 gap-3">
      {/* Header — matches GroupCard pattern */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
            Your Keywords
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-400/20 text-teal-300 font-medium tabular-nums">
            {keywords.length} added
          </span>
        </div>
        <h3 className="text-base font-semibold text-white/90 leading-snug">Client Keywords</h3>
        <p className="text-xs text-white/35 mt-1 leading-relaxed">
          Your custom keywords, enriched with search data and included in your content pipeline.
        </p>
      </div>

      {/* Keywords list */}
      <div className="space-y-1.5">
        {keywords.map((kw, i) => {
          if (editingKeyword === kw.keyword) {
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-500/5 border border-violet-400/20">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => editKeyDown(e, kw.keyword)}
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-white/90 focus:outline-none placeholder:text-white/20"
                  maxLength={100}
                />
                <button
                  onClick={() => saveEdit(kw.keyword)}
                  disabled={editing === kw.keyword}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-violet-400/20 text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-40"
                >
                  {editing === kw.keyword ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-white/[0.08] text-white/30 hover:text-white/50 transition-colors"
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
    </div>
  );
}

export function CustomKeywordSection({ token, customKeywords }: CustomKeywordSectionProps) {
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
    <div className="flex flex-col gap-3">
      {/* Feedback / error */}
      {feedback && <p className="text-xs text-teal-400">{feedback}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Add input strip — bare, no card wrapper */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your own keyword..."
          disabled={adding}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-teal-400/40 focus:ring-1 focus:ring-teal-400/20 disabled:opacity-40 transition-colors"
          maxLength={100}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !inputValue.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-500/20 text-teal-300 border border-teal-400/20 hover:bg-teal-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>

      {/* Group card — only renders when keywords exist */}
      {customKeywords.length > 0 && (
        <CustomKeywordsCard
          keywords={customKeywords}
          editing={editing}
          removing={removing}
          editValue={editValue}
          editingKeyword={editingKeyword}
          setEditValue={setEditValue}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveEdit={saveEdit}
          editKeyDown={editKeyDown}
          removeKeyword={removeKeyword}
        />
      )}
    </div>
  );
}
