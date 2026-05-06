import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { isoMondayUTC, type PackageTier } from "@/lib/packages";
import { getLatestAuditRun, getLatestIssueCount } from "@/lib/audit/queries";
import { getContentJobsForClient } from "@/lib/content";
import { DashboardHero } from "@/components/portal/DashboardHero";
import { PipelineBoard } from "@/components/portal/PipelineBoard";
import { WeeklyTargetsCard } from "@/components/portal/WeeklyTargetsCard";

export const revalidate = 0;

export default async function PortalDashboard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;
  const companyName = client.fields.company_name || "";

  const [pending, allChanges, auditRun, auditIssueCount, contentJobs] = await Promise.all([
    getPendingApprovals(clientId, recordId),
    getClientChanges(clientId, recordId),
    getLatestAuditRun(recordId).catch(() => null),
    getLatestIssueCount(recordId).catch(() => 0),
    getContentJobsForClient(companyName).catch(() => []),
  ]);

  const status = client.fields.status || client.fields.plan_status || "form_submitted";
  const contactName = client.fields.contact_name || client.fields.company_name || "there";

  const pendingCount = pending.length;
  const approvedCount = allChanges.filter(
    (c) => (c.fields.approval || c.fields.approval_status) === "approved" &&
            c.fields.execution_status !== "complete" && !c.fields.implemented_at
  ).length;
  const implementedCount = allChanges.filter(
    (c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at
  ).length;
  const pendingTitleCount = contentJobs.filter(
    (j) => j.fields.title_status === "titled"
  ).length;
  const auditStatus = auditRun?.status ?? null;

  // ─── This-week deliverables ──────────────────────────────────────────
  const tier = (client.fields.package as PackageTier | undefined) ?? "growth";
  const weekStart = isoMondayUTC();
  const isThisWeek = (iso?: string): boolean => {
    if (!iso) return false;
    return iso >= weekStart;
  };
  // Derive what we can from existing Changes data — these will become non-zero
  // as soon as approvals start flowing through this week.
  const internalLinksThisWeek = allChanges.filter(
    (c) => (c.fields.type ?? "").toLowerCase() === "internal link" &&
            (c.fields.execution_status === "complete" || !!c.fields.implemented_at) &&
            isThisWeek(c.fields.implemented_at as string | undefined),
  ).length;
  const deliveredThisWeek = {
    internal_links: internalLinksThisWeek,
  };

  return (
    <div className="flex flex-col gap-5 overflow-hidden" style={{ height: "calc(100vh - 5rem)" }}>
      {/* Status banner */}
      <div className="flex-shrink-0">
        <DashboardHero
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          implementedCount={implementedCount}
          pendingTitleCount={pendingTitleCount}
          auditIssueCount={auditIssueCount}
          auditStatus={auditStatus}
          token={token}
          contactName={contactName}
          status={status}
        />
      </div>

      {/* This Week deliverables */}
      <div className="flex-shrink-0">
        <WeeklyTargetsCard packageTier={tier} delivered={deliveredThisWeek} />
      </div>

      {/* Pipeline Board */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex-shrink-0">
          Pipeline
        </div>
        <div className="flex-1 min-h-0">
          <PipelineBoard changes={allChanges} token={token} />
        </div>
      </div>
    </div>
  );
}
