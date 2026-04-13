"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_STYLES } from "./keyword-styles";
import { useKeywordActions } from "./useKeywordActions";

// Client-side intent inference — mirrors the server-side logic
function inferIntent(keyword: string): string {
  const kw = keyword.toLowerCase();
  if (/pricing|price|\bcost\b|\bbuy\b|near me|\bdemo\b|\bquote\b|\bhire\b|\bbook\b/.test(kw)) return "transactional";
  if (/\bvs\b|versus|alternative|compare|difference/.test(kw)) return "commercial";
  if (/^how |^why |^what |^when |^where |\bbest |\btop |\breview/.test(kw)) return "informational";
  return "informational";
}

export type Subkeyword = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  priority?: "high" | "medium" | "low";
};

export type KeywordGroup = {
  group: string;
  description: string;
  subkeywords: Subkeyword[];
};

function getDifficultyStyle(kd: number) {
  if (kd < 30) return { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Easy" };
  if (kd < 50) return { bg: "bg-amber-50 border-amber-200 text-amber-700", label: "Med" };
  return { bg: "bg-red-50 border-red-200 text-red-700", label: "Hard" };
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

type Priority = "high" | "medium" | "low";

const PRIORITY_STYLES: Record<Priority, { text: string; bg: string; border: string }> = {
  high:   { text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  medium: { text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  low:    { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};

export function SubkeywordRow({ kw, index, onRemove, onEdit, token, showPriority }: {
  kw: Subkeyword;
  index: number;
  onRemove?: () => void;
  onEdit?: () => void;
  token?: string;
  showPriority?: boolean;
}) {
  const router = useRouter();
  const diff = getDifficultyStyle(kw.difficulty);
  const rawPriority = kw.priority?.toLowerCase();
  const p: Priority = (rawPriority === "high" || rawPriority === "medium" || rawPriority === "low") ? rawPriority : "medium";
  const ps = PRIORITY_STYLES[p];

  const handlePriorityChange = async (newPriority: string) => {
    if (!token) return;
    await fetch("/api/portal/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "priority", token, keyword: kw.keyword, priority: newPriority }),
    });
    router.refresh();
  };

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 ${index === 0 ? "bg-slate-50 border border-slate-200 hover:bg-slate-100" : "bg-white border border-slate-100 hover:bg-slate-50"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 font-medium leading-snug">{kw.keyword}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {showPriority && (
          <select
            value={p}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className={`text-[10px] pl-1.5 pr-5 py-0.5 rounded-md border font-semibold appearance-none cursor-pointer transition-colors ${ps.bg} ${ps.text} ${ps.border} hover:opacity-80`}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' fill='none'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 5px center" }}
          >
            <option value="high">High</option>
            <option value="medium">Med</option>
            <option value="low">Low</option>
          </select>
        )}
        {kw.volume > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-medium tabular-nums">
            {formatVolume(kw.volume)}/mo
          </span>
        )}
        {kw.difficulty > 0 && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tabular-nums ${diff.bg}`}>
            KD {kw.difficulty}
          </span>
        )}
        {kw.intent && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 capitalize">
            {kw.intent}
          </span>
        )}
        {(onRemove || onEdit) && (
          <div className="flex items-center gap-1 ml-1">
            {onEdit && (
              <button onClick={onEdit} className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                Edit
              </button>
            )}
            {onRemove && (
              <button onClick={onRemove} className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition-colors">
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type OptimisticKw = Subkeyword & { _optimistic: true; _enriching: boolean };

export function GroupCard({ group, style, index, token, canDelete }: {
  group: KeywordGroup;
  style: typeof GROUP_STYLES[0];
  index: number;
  token?: string;
  canDelete?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(group.group);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(group.description || "");
  const [optimisticKws, setOptimisticKws] = useState<OptimisticKw[]>([]);

  const { editing, removing, feedback, error, addKeyword, editKeyword, removeKeyword, deleteGroup, renameGroup, updateDescription } =
    useKeywordActions(token || "");

  const handleAdd = async () => {
    if (!token) return;
    const kw = inputValue.trim();
    if (!kw) return;

    // Optimistic: show immediately with inferred intent, enriching indicator
    const optimistic: OptimisticKw = {
      keyword: kw,
      volume: 0,
      difficulty: 0,
      intent: inferIntent(kw),
      priority: "medium",
      _optimistic: true,
      _enriching: true,
    };
    setOptimisticKws((prev) => [...prev, optimistic]);
    setInputValue("");
    setShowAdd(false);

    // Fire API in background — DataForSEO enrichment may take a few seconds
    const ok = await addKeyword(kw, group.group);
    if (!ok) {
      // Remove optimistic entry on failure
      setOptimisticKws((prev) => prev.filter((k) => k.keyword !== kw));
    } else {
      // router.refresh() in addKeyword will pull real data from Airtable;
      // clear optimistic once server state arrives
      setOptimisticKws((prev) => prev.filter((k) => k.keyword !== kw));
    }
  };

  const startEdit = (keyword: string) => { setEditingKeyword(keyword); setEditValue(keyword); };
  const cancelEdit = () => { setEditingKeyword(null); setEditValue(""); };
  const saveEdit = async (oldKeyword: string) => {
    const newKw = editValue.trim();
    if (!newKw || newKw === oldKeyword) { cancelEdit(); return; }
    const ok = await editKeyword(oldKeyword, newKw);
    if (ok) cancelEdit();
  };

  const saveTitle = async () => {
    const newName = titleValue.trim();
    if (!newName || newName === group.group) { setEditingTitle(false); setTitleValue(group.group); return; }
    const ok = await renameGroup(group.group, newName);
    if (!ok) setTitleValue(group.group);
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    const newDesc = descValue.trim();
    if (newDesc === (group.description || "")) { setEditingDesc(false); return; }
    await updateDescription(group.group, newDesc);
    setEditingDesc(false);
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`Delete the "${group.group}" group and all its keywords?`)) return;
    await deleteGroup(group.group);
  };

  return (
    <div className={`bg-white rounded-2xl border-t-2 ${style.border} border border-slate-200 flex flex-col p-4 gap-3 transition-all duration-200 hover:shadow-[var(--shadow-md)]`} style={{ boxShadow: "var(--shadow-xs)" }}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${style.text}`}>
            Group {index + 1}
          </span>
          <div className="flex items-center gap-2">
            {token && (
              <button
                onClick={() => { setEditingTitle(true); setEditingDesc(false); }}
                className="text-[10px] text-slate-400 hover:text-slate-700 transition-colors"
              >
                Edit
              </button>
            )}
            {token && canDelete && (
              <button onClick={handleDeleteGroup} className="text-[10px] text-slate-300 hover:text-red-400 transition-colors">
                Delete
              </button>
            )}
          </div>
        </div>

        {token && editingTitle ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleValue(group.group); } }}
                autoFocus
                maxLength={60}
                placeholder="Group name"
                className="flex-1 text-base font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setEditingTitle(false); setTitleValue(group.group); setDescValue(group.description || ""); } }}
              placeholder="Description (optional)"
              rows={2}
              className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <div className="flex items-center gap-2">
              <button onClick={async () => { await saveTitle(); await saveDesc(); }} className="text-[10px] px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors">Save</button>
              <button onClick={() => { setEditingTitle(false); setTitleValue(group.group); setDescValue(group.description || ""); }} className="text-[10px] px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-base font-semibold text-slate-900 leading-snug">{group.group}</h3>
            {group.description && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{group.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Feedback / error */}
      {feedback && <p className="text-xs text-teal-700">{feedback}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Subkeywords */}
      <div className="space-y-1.5">
        {group.subkeywords.map((kw, i) => {
          if (token && editingKeyword === kw.keyword) {
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-indigo-200">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(kw.keyword); if (e.key === "Escape") cancelEdit(); }}
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none"
                  maxLength={100}
                />
                <button onClick={() => saveEdit(kw.keyword)} disabled={editing === kw.keyword} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-40">
                  {editing === kw.keyword ? "Saving…" : "Save"}
                </button>
                <button onClick={cancelEdit} className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
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
                showPriority
                token={token}
                onEdit={token && !editing ? () => startEdit(kw.keyword) : undefined}
                onRemove={token && !editing ? () => removeKeyword(kw.keyword) : undefined}
              />
            </div>
          );
        })}

        {/* Optimistic entries — appear instantly, shimmer while enriching */}
        {optimisticKws.map((kw) => (
          <div key={`opt-${kw.keyword}`} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white border border-slate-100 animate-pulse">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-800 font-medium leading-snug">{kw.keyword}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-400 capitalize">
                {kw.intent}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-slate-300">
                fetching data…
              </span>
            </div>
          </div>
        ))}

        {group.subkeywords.length === 0 && optimisticKws.length === 0 && (
          <div className="text-xs text-slate-300 text-center py-3">No keywords yet — add one below</div>
        )}
      </div>

      {/* Add keyword */}
      {token && (
        <div className={group.subkeywords.length > 0 ? "border-t border-slate-100 pt-3" : ""}>
          {showAdd ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAdd(false); setInputValue(""); } }}
                placeholder="Add a keyword..."
                autoFocus
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors"
                maxLength={100}
              />
              <button onClick={handleAdd} disabled={!inputValue.trim()} className="px-3 py-2 rounded-xl text-sm font-medium bg-teal-600 border border-teal-700 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                Add
              </button>
              <button onClick={() => { setShowAdd(false); setInputValue(""); }} className="px-3 py-2 rounded-xl text-sm border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className={`text-[10px] font-medium uppercase tracking-wider ${style.text} opacity-60 hover:opacity-100 transition-opacity`}>
              + Add keyword
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// "Create Group" card — appears at the end of the grid
export function CreateGroupCard({ token, style }: { token: string; style: typeof GROUP_STYLES[0] }) {
  const [inputValue, setInputValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { createGroup, error } = useKeywordActions(token);

  const handleCreate = async () => {
    const name = inputValue.trim();
    if (!name || creating) return;
    setCreating(true);
    const ok = await createGroup(name);
    setCreating(false);
    if (ok) { setInputValue(""); setShowForm(false); }
  };

  return (
    <div
      className={`bg-white rounded-2xl border-t-2 ${style.border} border border-dashed border-slate-200 flex flex-col items-center justify-center p-6 gap-3 min-h-[160px] transition-all duration-200`}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      {showForm ? (
        <div className="w-full space-y-2">
          <div className={`text-[10px] font-bold uppercase tracking-widest ${style.text} mb-2`}>New Group</div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setShowForm(false); setInputValue(""); } }}
            placeholder="Group name..."
            autoFocus
            maxLength={60}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !inputValue.trim()} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-teal-600 border border-teal-700 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {creating ? "Creating…" : "Create"}
            </button>
            <button onClick={() => { setShowForm(false); setInputValue(""); }} className="px-3 py-2 rounded-xl text-sm border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors group">
          <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
          <span className="text-xs font-medium">Create keyword group</span>
        </button>
      )}
    </div>
  );
}

interface KeywordGroupsProps {
  groups: KeywordGroup[];
  token?: string;
}

export function KeywordGroups({ groups, token }: KeywordGroupsProps) {
  const totalKeywords = groups.reduce((sum, g) => sum + g.subkeywords.length, 0);
  const allKds = groups.flatMap(g => g.subkeywords.map(kw => kw.difficulty)).filter(kd => kd > 0);
  const avgKd = allKds.length > 0 ? Math.round(allKds.reduce((a, b) => a + b, 0) / allKds.length) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5" style={{ boxShadow: "var(--shadow-xs)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Groups</div>
          <div className="text-lg font-bold text-slate-900 tabular">{groups.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5" style={{ boxShadow: "var(--shadow-xs)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Keywords</div>
          <div className="text-lg font-bold text-slate-900 tabular">{totalKeywords}</div>
        </div>
        {avgKd !== null && (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5" style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg Difficulty</div>
            <div className="text-lg font-bold text-slate-900 tabular">{avgKd}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {groups.map((group, i) => (
          <GroupCard
            key={group.group}
            group={group}
            style={GROUP_STYLES[i % GROUP_STYLES.length]}
            index={i}
            token={token}
            canDelete={false}
          />
        ))}
      </div>
    </div>
  );
}
