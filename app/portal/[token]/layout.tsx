import { notFound, redirect } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPortalSession } from "@/lib/portal-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/changes";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import { getEngainMentionStats } from "@/lib/engain";
import { PACKAGES, type PackageTier } from "@/lib/packages";
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
  // Accept either a valid portal session (client) or a valid admin session.
  // isAdminAuthenticated() is a fast HMAC-only check — no DB call.
  const [portalSession, isAdmin] = await Promise.all([
    getPortalSession(),
    isAdminAuthenticated(),
  ]);

  if (!portalSession && !isAdmin) {
    redirect(`/portal/login?token=${encodeURIComponent(token)}`);
  }

  if (portalSession && !isAdmin) {
    // Client session must belong to this portal
    if (portalSession.portal_token !== token) {
      redirect(`/portal/${portalSession.portal_token}`);
    }
  }
  // Admins pass through to any portal

  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;
  const companyName = client.fields.company_name || "";

  const engainProjectId = client.fields.engain_project_id || "";
  const pkg = client.fields.package as PackageTier | undefined;

  // Logo: use explicit logo_url, fall back to Google favicon from site_url
  const logoUrl = (() => {
    if (client.fields.logo_url) return client.fields.logo_url;
    try {
      const domain = new URL(client.fields.site_url || "").hostname;
      return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "";
    } catch {
      return "";
    }
  })();
  // Show Reddit tab for any client on a package (all tiers include reddit_comments)
  const hasReddit = !!(pkg && PACKAGES[pkg].reddit_comments > 0);

  const [pending, contentResults, contentJobs, engainStats] = await Promise.all([
    getPendingApprovals(clientId, recordId),
    getContentResultsForClient(companyName).catch(() => []),
    getContentJobsForClient(companyName).catch(() => []),
    engainProjectId
      ? getEngainMentionStats(engainProjectId).catch(() => null)
      : Promise.resolve(null),
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
      logoUrl={logoUrl}
      pendingCount={navigablePendingCount}
      contentReviewCount={contentReviewCount}
      titleProposalCount={titleProposalCount}
      contentOptimizationCount={contentOptimizationCount}
      internalLinksPendingCount={internalLinksPendingCount}
      categoryBreakdown={categoryBreakdown}
      isLoggedIn={true}
      monthlyProgress={<MonthlyProgressSidebar client={client} />}
      hasReddit={hasReddit}
      redditMentionCount={engainStats?.total ?? 0}
    >
      {children}
    </PortalSidebar>
  );
}
