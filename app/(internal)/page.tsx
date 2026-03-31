import Link from "next/link";
import { getClients } from "@/lib/clients";
import { getActiveJobs, getJobs } from "@/lib/jobs";
import { getPendingApprovals } from "@/lib/changes";
import { MetricTile } from "@/components/ui/MetricTile";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [clients, activeJobs, pendingChanges, recentJobs] = await Promise.all([
    getClients(),
    getActiveJobs(),
    getPendingApprovals(),
    getJobs(10),
  ]);

  const activeClients = clients.filter((c) => c.fields.plan_status === "active").length;
  const awaitingApproval = clients.filter((c) => c.fields.plan_status === "awaiting_approval");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-white/40 text-sm mt-1">System health at a glance</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile label="Total Clients" value={clients.length} accent="violet" />
        <MetricTile label="Active Clients" value={activeClients} accent="emerald" />
        <MetricTile label="Active Jobs" value={activeJobs.length} accent="blue" sub="queued + running" />
        <MetricTile label="Pending Approvals" value={pendingChanges.length} accent="amber" sub="across all clients" />
      </div>

      {/* Needs Attention */}
      {awaitingApproval.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Needs Attention
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {awaitingApproval.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <GlassCard hover className="p-4">
                  <div className="font-medium text-sm">{client.fields.company_name}</div>
                  <div className="text-white/40 text-xs mt-0.5 truncate">{client.fields.site_url}</div>
                  <div className="mt-3">
                    <StatusBadge value={client.fields.plan_status} variant="plan_status" />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Jobs */}
      <section>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
          Recent Jobs
        </h2>
        <GlassCard>
          <div className="divide-y divide-white/8">
            {recentJobs.length === 0 && (
              <div className="px-5 py-8 text-center text-white/30 text-sm">No jobs yet</div>
            )}
            {recentJobs.map((job) => (
              <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {job.fields.type?.replace(/_/g, " ")}
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">
                    {job.fields.started_at
                      ? new Date(job.fields.started_at).toLocaleString()
                      : "Queued"}
                  </div>
                </div>
                <StatusBadge value={job.fields.job_status} variant="job_status" />
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
