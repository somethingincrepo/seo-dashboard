import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { KeywordGroups, type KeywordGroup } from "@/components/portal/KeywordGroups";

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

  const contentTone = client.fields.content_tone || "";
  const contentAudience = client.fields.content_audience || "";

  const isEmpty = groups.length === 0;

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white/90">Keywords</h1>
        <p className="text-base text-white/40 mt-1">
          Keyword groups and target subkeywords driving your content strategy
        </p>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <div className="text-3xl mb-4 text-white/20">◈</div>
            <div className="font-medium text-white/50 mb-2">Keyword research in progress</div>
            <div className="text-sm text-white/30 leading-relaxed">
              Your 5 keyword groups will appear here once your Month 1 audit is complete.
              Each group will include 2 target subkeywords with volume and difficulty data.
            </div>
          </div>
        </div>
      ) : (
        <KeywordGroups
          groups={groups}
          contentTone={contentTone}
          contentAudience={contentAudience}
        />
      )}
    </div>
  );
}
