"use client";

import { GROUP_STYLES } from "./keyword-styles";

export type Subkeyword = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
};

export type KeywordGroup = {
  group: string;
  description: string;
  subkeywords: Subkeyword[];
};

function getDifficultyStyle(kd: number) {
  if (kd < 30) return { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Easy" };
  if (kd < 50) return { bg: "bg-amber-50 border-amber-200 text-amber-700",       label: "Med" };
  return               { bg: "bg-red-50 border-red-200 text-red-700",             label: "Hard" };
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000)  return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function SubkeywordRow({ kw, index, onRemove, onEdit }: { kw: Subkeyword; index: number; onRemove?: () => void; onEdit?: () => void }) {
  const diff = getDifficultyStyle(kw.difficulty);
  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 ${index === 0 ? "bg-slate-50 border border-slate-200 hover:bg-slate-100" : "bg-white border border-slate-100 hover:bg-slate-50"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 font-medium leading-snug">{kw.keyword}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {kw.volume > 0 ? (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-medium tabular-nums">
            {formatVolume(kw.volume)}/mo
          </span>
        ) : kw.difficulty > 0 ? (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-medium">
            Low
          </span>
        ) : null}
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

export function GroupCard({ group, style, index }: { group: KeywordGroup; style: typeof GROUP_STYLES[0]; index: number }) {
  return (
    <div className={`bg-white rounded-2xl border-t-2 ${style.border} border border-slate-200 flex flex-col p-4 gap-3 transition-all duration-200 hover:shadow-[var(--shadow-md)]`} style={{ boxShadow: "var(--shadow-xs)" }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${style.text}`}>
            Group {index + 1}
          </span>
        </div>
        <h3 className="text-base font-semibold text-slate-900 leading-snug">{group.group}</h3>
        {group.description && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{group.description}</p>
        )}
      </div>

      {/* Subkeywords */}
      <div className="space-y-1.5">
        {group.subkeywords.map((kw, i) => (
          <SubkeywordRow key={i} kw={kw} index={i} />
        ))}
        {group.subkeywords.length === 0 && (
          <div className="text-xs text-slate-300 text-center py-3">No subkeywords</div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5" style={{ boxShadow: "var(--shadow-xs)" }}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-900 tabular">{value}</div>
    </div>
  );
}

interface KeywordGroupsProps {
  groups: KeywordGroup[];
}

export function KeywordGroups({ groups }: KeywordGroupsProps) {
  const totalKeywords = groups.reduce((sum, g) => sum + g.subkeywords.length, 0);
  const allKds = groups.flatMap(g => g.subkeywords.map(kw => kw.difficulty)).filter(kd => kd > 0);
  const avgKd = allKds.length > 0 ? Math.round(allKds.reduce((a, b) => a + b, 0) / allKds.length) : null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="Groups" value={groups.length} />
        <StatPill label="Keywords" value={totalKeywords} />
        {avgKd !== null && <StatPill label="Avg Difficulty" value={avgKd} />}
      </div>

      {/* Group cards — 2 column grid */}
      <div className="grid grid-cols-2 gap-4">
        {groups.map((group, i) => (
          <GroupCard
            key={i}
            group={group}
            style={GROUP_STYLES[i % GROUP_STYLES.length]}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
