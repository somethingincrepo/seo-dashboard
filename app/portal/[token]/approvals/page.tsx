import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientChanges } from "@/lib/changes";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import { getContentRefreshesForClient, getPageCreationSuggestionsForClient, getFaqSectionsForClient } from "@/lib/supabase";
import { DeliverableKanban, type InternalLinkChange } from "@/components/portal/DeliverableKanban";

export const revalidate = 0;

export default async function ApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;
  const companyName = client.fields.company_name || "";

  const [
    allChanges,
    contentJobs,
    contentResults,
    contentRefreshes,
    pageCreations,
    faqSections,
  ] = await Promise.all([
    getClientChanges(clientId, recordId).catch(() => []),
    getContentJobsForClient(companyName).catch(() => []),
    getContentResultsForClient(companyName).catch(() => []),
    getContentRefreshesForClient(recordId).catch(() => []),
    getPageCreationSuggestionsForClient(recordId).catch(() => []),
    getFaqSectionsForClient(recordId).catch(() => []),
  ]);

  const internalLinkChanges: InternalLinkChange[] = allChanges
    .filter((c) => (c.fields.type ?? "").toLowerCase() === "internal link")
    .map((c) => ({
      id: c.id,
      change_title: c.fields.change_title ?? null,
      page_url: c.fields.page_url ?? null,
      approval: c.fields.approval ?? null,
      execution_status: c.fields.execution_status ?? null,
      identified_at: c.fields.identified_at ?? null,
      approved_at: c.fields.approved_at ?? null,
    }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Deliverables</h1>
        <p className="text-base text-slate-500 mt-1">
          Status of all active work — content, refreshes, page creation, internal links, and FAQ sections.
        </p>
      </div>

      <DeliverableKanban
        contentJobs={contentJobs}
        contentResults={contentResults}
        contentRefreshes={contentRefreshes}
        pageCreations={pageCreations}
        internalLinkChanges={internalLinkChanges}
        faqSections={faqSections}
        token={token}
      />
    </div>
  );
}
