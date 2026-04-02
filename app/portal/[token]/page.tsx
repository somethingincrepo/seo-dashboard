import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { DashboardHero } from "@/components/portal/DashboardHero";
import { PipelineBoard } from "@/components/portal/PipelineBoard";

export const revalidate = 0;

export default async function PortalDashboard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;

  const [pending, allChanges] = await Promise.all([
    getPendingApprovals(clientId),
    getClientChanges(clientId),
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

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Hero Action Card */}
      <DashboardHero
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        implementedCount={implementedCount}
        token={token}
        contactName={contactName}
        status={status}
      />

      {/* Pipeline Board — fills remaining space */}
      <section className="flex-1 mt-4 overflow-hidden">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">
          Pipeline
        </div>
        <PipelineBoard changes={allChanges} token={token} />
      </section>
    </div>
  );
}
