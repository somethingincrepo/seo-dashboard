import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getContentJobsForClient, getContentResultsForClient, type ContentJob, type ContentResult } from "@/lib/content";
import { ContentOptimization } from "@/components/portal/ContentOptimization";

export const dynamic = "force-dynamic";

export default async function ContentOptimizationPage({
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

  // Only refresh jobs
  const refreshJobs = allJobs.filter((j) => !!j.fields.refresh_url);

  // Build jobId → result map
  const resultByJobId = new Map<string, ContentResult>();
  for (const result of allResults) {
    for (const jid of result.fields["Job ID"] ?? []) {
      resultByJobId.set(jid, result);
    }
  }

  const items: { job: ContentJob; result: ContentResult | null }[] = refreshJobs.map((job) => ({
    job,
    result: resultByJobId.get(job.id) ?? null,
  }));

  // Sort: ready-for-review → in-progress → completed
  items.sort((a, b) => {
    const rank = (x: typeof a) => {
      const ts = x.job.fields.title_status;
      const approved = x.result?.fields.portal_approval;
      if (ts === "completed" && !approved) return 0;
      if (ts === "approved" && !x.result) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  const clientPackage = client.fields.package ?? "starter";

  return (
    <div className="-mx-10 flex flex-col min-h-[calc(100vh-5rem)]">
      <div className="px-10 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Content Refreshes
        </h1>
        <p className="text-base text-slate-500 mt-1">
          Each month we update existing pages and blog posts to improve keyword coverage, strengthen headings, and sharpen body copy
        </p>
      </div>

      <ContentOptimization items={items} token={token} clientPackage={clientPackage} />
    </div>
  );
}
