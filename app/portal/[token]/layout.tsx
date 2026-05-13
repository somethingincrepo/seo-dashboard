import { notFound, redirect } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPortalSession, destroyPortalSession } from "@/lib/portal-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/changes";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
import { getContentRefreshesForClient, getPageCreationSuggestionsForClient, getFaqSectionsForClient } from "@/lib/supabase";
import { getEngainMentionStats } from "@/lib/engain";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { getLatestIssueCount } from "@/lib/audit/queries";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { MonthlyProgressSidebar } from "@/components/portal/MonthlyProgress";
import { AutoRefresh } from "@/components/AutoRefresh";

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
 redirect(`/login?next=${encodeURIComponent(`/portal/${token}`)}`);
 }

 if (portalSession && !isAdmin) {
 // Client session must belong to this portal — if navigating to a different
 // client's URL, clear the stale session and send them to the new portal's login.
 if (portalSession.portal_token !== token) {
 await destroyPortalSession();
 redirect(`/login?next=${encodeURIComponent(`/portal/${token}`)}`);
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

 const [pending, contentResults, contentJobs, contentRefreshes, pageCreationSuggestions, faqSections, engainStats, auditIssueCount, opportunityNewCount] = await Promise.all([
 getPendingApprovals(clientId, recordId),
 getContentResultsForClient(companyName).catch(() => []),
 getContentJobsForClient(companyName).catch(() => []),
 getContentRefreshesForClient(client.id).catch(() => []),
 getPageCreationSuggestionsForClient(client.id).catch(() => []),
 getFaqSectionsForClient(client.id).catch(() => []),
 engainProjectId
 ? getEngainMentionStats(engainProjectId).catch(() => null)
 : Promise.resolve(null),
 getLatestIssueCount(recordId).catch(() => 0),
 listOpportunitiesForClient(client.id, { status: "new", limit: 1 })
 .then((r) => r.total)
 .catch(() => 0),
 ]);

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

 const contentOptimizationCount = contentRefreshes.filter(
 (r) => r.status === "completed" && !r.portal_approval
 ).length;

 const pageCreationCount = pageCreationSuggestions.filter(
 (s) => (s.status === "suggested" || s.status === "content_ready") && s.portal_approval !== "skipped"
 ).length;

 const faqSectionCount = faqSections.filter(
 (s) => s.status === "suggested" && s.portal_approval !== "skipped"
 ).length;

 // Unified "Needs Review" count for the Approvals badge (Reddit excluded — it has its own sidebar badge)
 const approvalsActionCount =
 titleProposalCount +
 contentReviewCount +
 contentOptimizationCount +
 pageCreationCount +
 internalLinksPendingCount +
 faqSectionCount;

 return (
 <PortalSidebar
 companyName={companyName || "Your Portal"}
 token={token}
 logoUrl={logoUrl}
 approvalsActionCount={approvalsActionCount}
 contentReviewCount={contentReviewCount}
 titleProposalCount={titleProposalCount}
 contentOptimizationCount={contentOptimizationCount}
 pageCreationCount={pageCreationCount}
 internalLinksPendingCount={internalLinksPendingCount}
 auditIssueCount={auditIssueCount}
 isLoggedIn={true}
 monthlyProgress={<MonthlyProgressSidebar client={client} />}
 hasReddit={hasReddit}
 redditMentionCount={(engainStats?.total ?? 0) + opportunityNewCount}
 faqSectionCount={faqSectionCount}
 >
 <AutoRefresh intervalMs={60_000} />
 {children}
 </PortalSidebar>
 );
}
