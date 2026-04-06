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

  // Focus edit input when entering edit mode
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

  return (
    <div className="bg-white/[0.03] rounded-2xl border-t-2 border-t-teal-500 border border-white/[0.06] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
              Your Keywords
            </span>
            {customKeywords.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-400/15 text-teal-400/70 font-medium">
                {customKeywords.length} added
              </span>
            )}
          </div>
          <p className="text-xs text-white/30 leading-relaxed">
            Keywords you add here flow into your content pipeline alongside your AI-generated groups.
          </p>
        </div>
      </div>

      {/* Add input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a keyword..."
          disabled={adding}
          className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!inputValue.trim() || adding}
          className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium bg-teal-500/20 border border-teal-400/30 text-teal-300 hover:bg-teal-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>

      {/* Feedback / error */}
      {feedback && (
        <div className="text-xs text-teal-400/80 -mt-2">{feedback}</div>
      )}
      {error && (
        <div className="text-xs text-red-400/80 -mt-2">{error}</div>
      )}

      {/* Existing keywords list */}
      {customKeywords.length > 0 && (
        <div className="space-y-1.5">
          {customKeywords.map((kw, i) => {
            const isThisEditing = editingKeyword === kw.keyword;
            const isThisRemoving = removing === kw.keyword;
            const isThisSaving = editing === kw.keyword;
            const anyEditActive = editingKeyword !== null;

            if (isThisEditing) {
              // Inline edit row
              return (
                <div
                  key={kw.keyword}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-violet-400/20"
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
                    className="flex-1 bg-transparent text-sm text-white/80 focus:outline-none min-w-0"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editDraft.trim() || isThisSaving}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-400/25 text-violet-300 hover:bg-violet-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isThisSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-[10px] text-white/30 hover:text-white/50 transition-colors px-1.5 py-1 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={kw.keyword} className={`transition-opacity ${isThisRemoving ? "opacity-40 pointer-events-none" : ""}`}>
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
      )}
    </div>
  );
}
