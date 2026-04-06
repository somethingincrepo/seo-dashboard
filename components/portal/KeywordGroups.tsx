"use client";

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

interface KeywordGroupsProps {
  groups: KeywordGroup[];
}

const GROUP_STYLES = [
  { border: "border-t-violet-500", dot: "bg-violet-400", text: "text-violet-400", pill: "bg-violet-500/10 text-violet-300 border-violet-400/20" },
  { border: "border-t-blue-500",   dot: "bg-blue-400",   text: "text-blue-400",   pill: "bg-blue-500/10 text-blue-300 border-blue-400/20" },
  { border: "border-t-emerald-500",dot: "bg-emerald-400",text: "text-emerald-400",pill: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20" },
  { border: "border-t-amber-500",  dot: "bg-amber-400",  text: "text-amber-400",  pill: "bg-amber-500/10 text-amber-300 border-amber-400/20" },
  { border: "border-t-rose-500",   dot: "bg-rose-400",   text: "text-rose-400",   pill: "bg-rose-500/10 text-rose-300 border-rose-400/20" },
  { border: "border-t-cyan-500",   dot: "bg-cyan-400",   text: "text-cyan-400",   pill: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20" },
];

function getDifficultyStyle(kd: number) {
  if (kd < 30) return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-400/20", label: "Easy" };
  if (kd < 50) return { text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-400/20",   label: "Med" };
  return               { text: "text-red-400",     bg: "bg-red-500/10 border-red-400/20",       label: "Hard" };
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000)  return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function SubkeywordRow({ kw, index, onRemove, onEdit }: { kw: Subkeyword; index: number; onRemove?: () => void; onEdit?: () => void }) {
  const diff = getDifficultyStyle(kw.difficulty);
  return (
    <div className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl ${index === 0 ? "bg-white/[0.03]" : "bg-white/[0.015]"} border border-white/[0.04]`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white/80 font-medium leading-snug">{kw.keyword}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {kw.volume > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/40 font-medium tabular-nums">
            {formatVolume(kw.volume)}/mo
          </span>
        )}
        {kw.difficulty > 0 && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tabular-nums ${diff.bg} ${diff.text}`}>
            KD {kw.difficulty}
          </span>
        )}
        {kw.intent && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/30 capitalize">
            {kw.intent}
          </span>
        )}
        {(onRemove || onEdit) && (
          <div className="hidden group-hover:flex items-center gap-1 ml-1">
            {onEdit && (
              <button onClick={onEdit} className="text-[10px] px-2 py-0.5 rounded-md border border-white/[0.08] text-white/30 hover:text-violet-300 hover:border-violet-400/30 transition-colors">
                Edit
              </button>
            )}
            {onRemove && (
              <button onClick={onRemove} className="text-[10px] px-2 py-0.5 rounded-md border border-white/[0.08] text-white/30 hover:text-red-400 hover:border-red-400/30 transition-colors">
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupCard({ group, style, index }: { group: KeywordGroup; style: typeof GROUP_STYLES[0]; index: number }) {
  return (
    <div className={`bg-white/[0.03] rounded-2xl border-t-2 ${style.border} border border-white/[0.06] flex flex-col p-4 gap-3`}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${style.text}`}>
            Group {index + 1}
          </span>
        </div>
        <h3 className="text-base font-semibold text-white/90 leading-snug">{group.group}</h3>
        {group.description && (
          <p className="text-xs text-white/35 mt-1 leading-relaxed">{group.description}</p>
        )}
      </div>

      {/* Subkeywords */}
      <div className="space-y-1.5">
        {group.subkeywords.map((kw, i) => (
          <SubkeywordRow key={i} kw={kw} index={i} />
        ))}
        {group.subkeywords.length === 0 && (
          <div className="text-xs text-white/20 text-center py-3">No subkeywords</div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-0.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</div>
      <div className="text-lg font-bold text-white/80">{value}</div>
    </div>
  );
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
