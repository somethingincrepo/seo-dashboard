import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { DashboardHero } from "@/components/portal/DashboardHero";
import { DashboardTimeline } from "@/components/portal/DashboardTimeline";
import { PipelineBoard } from "@/components/portal/PipelineBoard";

export const revalidate = 0;

export default async function PortalDashboard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;

  const [pending, reports, allChanges] = await Promise.all([
    getPendingApprovals(clientId),
    getClientReports(clientId),
    getClientChanges(clientId),
  ]);

  const status = client.fields.status || client.fields.plan_status || "form_submitted";
  const contactName = client.fields.contact_name || client.fields.company_name || "there";
  const latestReport = reports[0];

  const pendingCount = pending.length;
  const approvedCount = allChanges.filter(
    (c) => (c.fields.approval || c.fields.approval_status) === "approved" &&
            c.fields.execution_status !== "complete" && !c.fields.implemented_at
  ).length;
  const implementedCount = allChanges.filter(
    (c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at
  ).length;
  const tier1Ids = pending
    .filter((c) => c.fields.implementation_tier === "tier_1")
    .map((c) => c.id);
  const tier1Count = tier1Ids.length;

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">
          Welcome, {contactName.split(" ")[0]}
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Here's what's happening with your SEO.
        </p>
      </div>

      {/* Hero Action Card */}
      <DashboardHero
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        implementedCount={implementedCount}
        tier1Count={tier1Count}
        tier1Ids={tier1Ids}
        token={token}
        contactName={contactName}
        status={status}
        reports={reports}
      />

      {/* Pipeline Board */}
      {allChanges.length > 0 && (
        <section>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">
            Pipeline
          </div>
          <PipelineBoard changes={allChanges} token={token} />
        </section>
      )}

      {/* Timeline */}
      <DashboardTimeline
        client={client}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        implementedCount={implementedCount}
      />

      {/* Latest Report */}
      {latestReport && (
        <section>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">
            Latest Report — Month {latestReport.fields.month}
          </div>
          <GlassCard className="p-5">
            <div className="grid grid-cols-3 gap-6 text-center mb-4">
              {[
                { val: latestReport.fields.gsc_clicks_delta, label: "Clicks" },
                { val: latestReport.fields.gsc_impressions_delta, label: "Impressions" },
                { val: latestReport.fields.ai_citation_score, label: "AI Score", noSign: true },
              ].map(({ val, label, noSign }) => (
                <div key={label}>
                  <div className={`text-2xl font-bold ${
                    noSign ? "text-blue-400" :
                    (val ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {val == null ? "—" : noSign ? val : `${val >= 0 ? "+" : ""}${val}`}
                  </div>
                  <div className="text-white/30 text-xs mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <Link href={`/portal/${token}/reports`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                View all reports →
              </Link>
              {latestReport.fields.pdf_url && (
                <a href={latestReport.fields.pdf_url} target="_blank" rel="noreferrer"
                  className="text-xs text-white/40 hover:text-white/60 transition-colors">
                  Download PDF ↗
                </a>
              )}
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  );
}
