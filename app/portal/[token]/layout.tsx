import { notFound, redirect } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPortalSession } from "@/lib/portal-auth";
import { getPendingApprovals } from "@/lib/changes";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { MonthlyProgressSidebar } from "@/components/portal/MonthlyProgress";

export const revalidate = 0;

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // --- Auth ---
  // Check for a valid portal_session cookie first
  const session = await getPortalSession();
  let isLoggedIn = false;

  if (session) {
    if (session.portal_token !== token) {
      // Cookie belongs to a different client — redirect to their portal
      redirect(`/portal/${session.portal_token}`);
    }
    isLoggedIn = true;
  }

  // Always load client by token (URL token access is always allowed)
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;
  const companyName = client.fields.company_name || "";

  const [pending, contentResults, contentJobs] = await Promise.all([
    getPendingApprovals(clientId, recordId),
    getContentResultsForClient(companyName).catch(() => []),
    getContentJobsForClient(companyName).catch(() => []),
  ]);

  const KNOWN_CATS = ["Technical", "On-Page", "Content", "AI-GEO"];
  const categoryBreakdown: Record<string, number> = {};
  for (const c of pending) {
    const raw = c.fields.cat || c.fields.category || "";
    const cat = KNOWN_CATS.includes(raw) ? raw : null;
    if (cat) categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  }
  const navigablePendingCount = Object.values(categoryBreakdown).reduce(
    (a, b) => a + b,
    0
  );

  // Pending Internal Link changes — already in the `pending` array, no extra fetch needed
  const internalLinksPendingCount = pending.filter(
    (c) => (c.fields.type ?? "").toLowerCase() === "internal link"
  ).length;

  const contentReviewCount = contentResults.filter(
    (r) => !r.fields.portal_approval
  ).length;

  const titleProposalCount = contentJobs.filter(
    (j) => j.fields.title_status === "titled"
  ).length;

  // Refresh jobs that have completed results awaiting portal approval
  const refreshResultJobIds = new Set(
    contentResults
      .filter((r) => !r.fields.portal_approval)
      .flatMap((r) => r.fields["Job ID"] ?? [])
  );
  const contentOptimizationCount = contentJobs.filter(
    (j) => !!j.fields.refresh_url && refreshResultJobIds.has(j.id)
  ).length;

  return (
    <PortalSidebar
      companyName={companyName || "Your Portal"}
      token={token}
      pendingCount={navigablePendingCount}
      contentReviewCount={contentReviewCount}
      titleProposalCount={titleProposalCount}
      contentOptimizationCount={contentOptimizationCount}
      internalLinksPendingCount={internalLinksPendingCount}
      categoryBreakdown={categoryBreakdown}
      isLoggedIn={isLoggedIn}
      monthlyProgress={<MonthlyProgressSidebar client={client} />}
    >
      {children}
    </PortalSidebar>
  );
}
