import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import { ContentKanban } from "@/components/portal/ContentKanban";

export const revalidate = 0;

export default async function ContentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const companyName = client.fields.company_name || "Your Company";

  const [jobs, results] = await Promise.all([
    getContentJobsForClient(companyName).catch(() => []),
    getContentResultsForClient(companyName).catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content</h1>
        <p className="text-base text-slate-500 mt-1">
          Title proposals and generated articles
        </p>
      </div>

      {jobs.length === 0 && results.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl mb-4 text-slate-300">◆</div>
            <div className="font-medium text-slate-500 mb-2">No content yet</div>
            <div className="text-sm text-slate-400 max-w-xs mx-auto">
              Title proposals and articles will appear here once your content pipeline is active.
            </div>
          </div>
        </div>
      ) : (
        <ContentKanban
          jobs={jobs}
          results={results}
          token={token}
        />
      )}
    </div>
  );
}
