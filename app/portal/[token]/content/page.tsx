import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import { ContentKanban } from "@/components/portal/ContentKanban";
import { PublishCalendar } from "@/components/portal/PublishCalendar";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const companyName = client.fields.company_name || "Your Company";

  const [allJobs, allResults] = await Promise.all([
    getContentJobsForClient(companyName).catch(() => []),
    getContentResultsForClient(companyName).catch(() => []),
  ]);

  // Refresh jobs live in Content Optimization — exclude them here
  const jobs = allJobs.filter((j) => !j.fields.refresh_url);

  // Exclude results linked to refresh jobs
  const refreshJobIds = new Set(allJobs.filter((j) => !!j.fields.refresh_url).map((j) => j.id));
  const results = allResults.filter(
    (r) => !(r.fields["Job ID"] ?? []).some((jid) => refreshJobIds.has(jid))
  );

  return (
    <div className="-mx-10 flex flex-col min-h-[calc(100vh-5rem)]">
      <div className="px-10 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content Pipeline</h1>
        <p className="text-base text-slate-500 mt-1">
          Track every article from title approval through publication — refreshes are in{" "}
          <strong>Content Optimization</strong>
        </p>
      </div>

      {jobs.length === 0 && results.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-3xl mb-4 text-slate-300">◆</div>
            <div className="font-medium text-slate-500 mb-2">No content in progress</div>
            <div className="text-sm text-slate-400 max-w-xs mx-auto">
              Articles appear here once a title is approved. Approve titles in the Title Proposals section.
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

      <div className="px-10 mt-10 mb-8">
        <PublishCalendar token={token} />
      </div>
    </div>
  );
}
