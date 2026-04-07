import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { type KeywordGroup, type Subkeyword, GroupCard } from "@/components/portal/KeywordGroups";
import { GROUP_STYLES } from "@/components/portal/keyword-styles";
import { CustomKeywordSection } from "@/components/portal/CustomKeywordSection";

export const revalidate = 0;

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  let groups: KeywordGroup[] = [];
  try {
    if (client.fields.keyword_groups) {
      groups = JSON.parse(client.fields.keyword_groups);
    }
  } catch {
    // malformed JSON — treat as empty
  }

  let customGroups: KeywordGroup[] = [];
  try {
    if (client.fields.custom_keyword_groups) {
      customGroups = JSON.parse(client.fields.custom_keyword_groups);
    }
  } catch {
    // malformed JSON — treat as empty
  }

  const customKeywords: Subkeyword[] = customGroups.flatMap((g) => g.subkeywords);
  const aiKeywordCount = groups.reduce((sum, g) => sum + g.subkeywords.length, 0);
  const totalKeywords = aiKeywordCount + customKeywords.length;
  const allKds = [...groups, ...customGroups].flatMap((g) => g.subkeywords.map((kw) => kw.difficulty)).filter((kd) => kd > 0);
  const avgKd = allKds.length > 0 ? Math.round(allKds.reduce((a, b) => a + b, 0) / allKds.length) : null;
  const hasKeywords = groups.length > 0 || customKeywords.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-0">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Keywords</h1>
        <p className="text-base text-slate-500 mt-1">
          Keyword groups and target subkeywords driving your content strategy
        </p>
      </div>

      {!hasKeywords ? (
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <div className="text-3xl mb-4 text-slate-300">◈</div>
            <div className="font-medium text-slate-500 mb-2">Keyword research in progress</div>
            <div className="text-sm text-slate-400 leading-relaxed">
              Your 6 keyword groups will appear here once your Month 1 audit is complete.
              Each group will include 5 target subkeywords with volume and difficulty data.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5" style={{ boxShadow: "var(--shadow-xs)" }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Groups</div>
              <div className="text-lg font-bold text-slate-900 tabular">{groups.length + 1}</div>
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

          {/* AI group cards — 2 column grid */}
          <div className="grid grid-cols-2 gap-4">
            {groups.map((group, i) => (
              <GroupCard
                key={i}
                group={group}
                style={GROUP_STYLES[i % GROUP_STYLES.length]}
                index={i}
                token={token}
              />
            ))}
          </div>

          {/* Custom keyword section — full width, below the grid */}
          <CustomKeywordSection
            token={token}
            customKeywords={customKeywords}
            groupIndex={groups.length}
            showPriority
          />
        </>
      )}
    </div>
  );
}
