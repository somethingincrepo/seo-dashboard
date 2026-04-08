import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { type KeywordGroup, GroupCard, CreateGroupCard } from "@/components/portal/KeywordGroups";
import { GROUP_STYLES, CUSTOM_STYLE } from "@/components/portal/keyword-styles";

export const revalidate = 0;

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  let aiGroups: KeywordGroup[] = [];
  try {
    if (client.fields.keyword_groups) {
      aiGroups = JSON.parse(client.fields.keyword_groups);
    }
  } catch {
    // malformed — treat as empty
  }

  let customGroups: KeywordGroup[] = [];
  try {
    if (client.fields.custom_keyword_groups) {
      customGroups = JSON.parse(client.fields.custom_keyword_groups);
    }
  } catch {
    // malformed — treat as empty
  }

  // Unified list: AI groups first, then client-created groups
  const allGroups = [...aiGroups, ...customGroups];
  const totalKeywords = allGroups.reduce((sum, g) => sum + g.subkeywords.length, 0);
  const allKds = allGroups.flatMap((g) => g.subkeywords.map((kw) => kw.difficulty)).filter((kd) => kd > 0);
  const avgKd = allKds.length > 0 ? Math.round(allKds.reduce((a, b) => a + b, 0) / allKds.length) : null;
  const hasKeywords = allGroups.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Keywords</h1>
        <p className="text-base text-slate-500 mt-1">
          Keyword groups and target subkeywords driving your content strategy
        </p>
      </div>

      {!hasKeywords ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-sm">
            <div className="text-3xl mb-4 text-slate-300">◈</div>
            <div className="font-medium text-slate-500 mb-2">Keyword research in progress</div>
            <div className="text-sm text-slate-400 leading-relaxed mb-6">
              Your keyword groups will appear here once your Month 1 audit is complete.
            </div>
            {/* Allow creating groups even before AI groups are ready */}
            <div className="grid grid-cols-1 gap-4">
              <CreateGroupCard token={token} style={GROUP_STYLES[0]} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5" style={{ boxShadow: "var(--shadow-xs)" }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Groups</div>
              <div className="text-lg font-bold text-slate-900 tabular">{allGroups.length}</div>
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

          {/* Unified group grid — AI groups + custom groups + Create button */}
          <div className="grid grid-cols-2 gap-4">
            {aiGroups.map((group, i) => (
              <GroupCard
                key={group.group}
                group={group}
                style={GROUP_STYLES[i % GROUP_STYLES.length]}
                index={i}
                token={token}
                canDelete={false}
              />
            ))}
            {customGroups.map((group, i) => (
              <GroupCard
                key={group.group}
                group={group}
                style={CUSTOM_STYLE}
                index={aiGroups.length + i}
                token={token}
                canDelete={true}
              />
            ))}
            {/* Always show the Create Group card at the end */}
            <CreateGroupCard
              token={token}
              style={GROUP_STYLES[(aiGroups.length + customGroups.length) % GROUP_STYLES.length]}
            />
          </div>
        </>
      )}
    </div>
  );
}
