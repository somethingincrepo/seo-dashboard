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
  contentTone: string;
  contentAudience: string;
}

const GROUP_STYLES = [
  { border: "border-t-indigo-500", text: "text-indigo-700", pill: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { border: "border-t-blue-500",   text: "text-blue-700",   pill: "bg-blue-50 text-blue-700 border-blue-200" },
  { border: "border-t-emerald-500",text: "text-emerald-700",pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { border: "border-t-amber-500",  text: "text-amber-700",  pill: "bg-amber-50 text-amber-700 border-amber-200" },
  { border: "border-t-rose-500",   text: "text-rose-700",   pill: "bg-rose-50 text-rose-700 border-rose-200" },
];

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

export function SubkeywordRow({
  kw,
  index,
  onRemove,
  onEdit,
}: {
  kw: Subkeyword;
  index: number;
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  const diff = getDifficultyStyle(kw.difficulty);
  return (
    <div className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 ${index === 0 ? "bg-slate-50 border border-slate-200 hover:bg-slate-100" : "bg-white border border-slate-100 hover:bg-slate-50"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 font-medium leading-snug">{kw.keyword}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {kw.volume > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-medium tabular">
            {formatVolume(kw.volume)}/mo
          </span>
        )}
        {kw.difficulty > 0 && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tabular ${diff.bg}`}>
            KD {kw.difficulty}
          </span>
        )}
        {kw.intent && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 capitalize">
            {kw.intent}
          </span>
        )}
        {(onRemove || onEdit) && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-1 shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors px-1.5 py-0.5 rounded"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="text-[10px] text-slate-400 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded"
              >
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
    <div
      className={`bg-white rounded-2xl border-t-2 ${style.border} border border-slate-200 flex flex-col p-4 gap-3 transition-all duration-200 hover:shadow-[var(--shadow-md)]`}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
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

export function KeywordGroups({ groups, contentTone, contentAudience }: KeywordGroupsProps) {
  const totalKeywords = groups.reduce((sum, g) => sum + g.subkeywords.length, 0);
  const allKds = groups.flatMap(g => g.subkeywords.map(kw => kw.difficulty)).filter(kd => kd > 0);
  const avgKd = allKds.length > 0 ? Math.round(allKds.reduce((a, b) => a + b, 0) / allKds.length) : null;
  const intents = groups.flatMap(g => g.subkeywords.map(kw => kw.intent)).filter(Boolean);
  const topIntent = intents.length > 0
    ? Object.entries(intents.reduce<Record<string, number>>((acc, i) => { acc[i] = (acc[i] || 0) + 1; return acc; }, {}))
        .sort(([, a], [, b]) => b - a)[0]?.[0]
    : null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Groups" value={groups.length} />
        <StatPill label="Keywords" value={totalKeywords} />
        {avgKd !== null && <StatPill label="Avg Difficulty" value={avgKd} />}
        {contentTone && <StatPill label="Content Tone" value={contentTone} />}
        {!contentTone && topIntent && <StatPill label="Top Intent" value={topIntent} />}
      </div>

      {/* Audience / tone context */}
      {(contentTone || contentAudience) && (
        <div className="flex items-center gap-3 flex-wrap">
          {contentTone && (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
              {contentTone}
            </span>
          )}
          {contentAudience && (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600">
              {contentAudience}
            </span>
          )}
        </div>
      )}

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
