import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/clients";
import { getClientJobs } from "@/lib/jobs";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, jobs, changes, reports] = await Promise.all([
    getClient(id),
    getClientJobs(id),
    getClientChanges(id),
    getClientReports(id),
  ]);

  if (!client) notFound();

  const f = client.fields;
  const pending = changes.filter((c) => c.fields.approval === "pending");
  const approved = changes.filter((c) => c.fields.approval === "approved");

  // Group changes by page
  const byPage: Record<string, typeof changes> = {};
  changes.forEach((c) => {
    const page = c.fields.page_url || "Unknown";
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(c);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-white/40 text-sm hover:text-white/60 transition-colors">
            ← Clients
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{f.company_name}</h1>
          <a href={f.site_url} target="_blank" rel="noreferrer" className="text-white/40 text-sm hover:text-white/60 transition-colors">
            {f.site_url} ↗
          </a>
        </div>
        <StatusBadge value={f.plan_status || "form_submitted"} variant="plan_status" />
      </div>

      {/* Info + Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="text-white/40 text-xs mb-1">CMS</div>
          <div className="text-sm font-medium">{f.cms || "—"}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-white/40 text-xs mb-1">Month</div>
          <div className="text-sm font-medium">Month {f.month_number || 1}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-white/40 text-xs mb-1">Pending</div>
          <div className="text-sm font-medium text-amber-300">{pending.length} changes</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-white/40 text-xs mb-1">Implemented</div>
          <div className="text-sm font-medium text-emerald-300">{approved.length} changes</div>
        </GlassCard>
      </div>

      {/* External links */}
      <div className="flex gap-3 flex-wrap">
        {f.sheet_id && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${f.sheet_id}`}
            target="_blank"
            rel="noreferrer"
            className="glass glass-hover px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white transition-colors"
          >
            📊 Google Sheet
          </a>
        )}
        {f.drive_folder_id && (
          <a
            href={`https://drive.google.com/drive/folders/${f.drive_folder_id}`}
            target="_blank"
            rel="noreferrer"
            className="glass glass-hover px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white transition-colors"
          >
            📁 Drive Folder
          </a>
        )}
        {f.portal_token && (
          <Link
            href={`/portal/${f.portal_token}`}
            className="glass glass-hover px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white transition-colors"
          >
            🔗 Client Portal
          </Link>
        )}
      </div>

      {/* Changes by page */}
      {Object.keys(byPage).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Changes by Page</h2>
          <div className="space-y-3">
            {Object.entries(byPage).map(([page, pageChanges]) => (
              <GlassCard key={page} className="overflow-hidden">
                <div className="px-5 py-3 border-b border-white/8">
                  <div className="text-xs text-white/40 font-mono truncate">{page}</div>
                </div>
                <div className="divide-y divide-white/5">
                  {pageChanges.map((change) => (
                    <div key={change.id} className="px-5 py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <StatusBadge value={change.fields.cat} variant="category" />
                          <span className="text-xs text-white/60">{change.fields.type}</span>
                          <StatusBadge value={change.fields.confidence} variant="confidence" />
                        </div>
                        {change.fields.proposed_value && (
                          <div className="text-xs text-white/40 mt-1 line-clamp-2">
                            {change.fields.proposed_value}
                          </div>
                        )}
                      </div>
                      <StatusBadge value={change.fields.approval} variant="approval" />
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* Jobs timeline */}
      <section>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Job History</h2>
        <GlassCard>
          <div className="divide-y divide-white/8">
            {jobs.length === 0 && (
              <div className="px-5 py-8 text-center text-white/30 text-sm">No jobs yet</div>
            )}
            {jobs.map((job) => (
              <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{job.fields.type?.replace(/_/g, " ")}</div>
                  <div className="text-white/30 text-xs mt-0.5">
                    {job.fields.started_at ? new Date(job.fields.started_at).toLocaleString() : "Queued"}
                    {job.fields.completed_at && ` → ${new Date(job.fields.completed_at).toLocaleString()}`}
                  </div>
                  {job.fields.error_message && (
                    <div className="text-red-400 text-xs mt-1 line-clamp-1">{job.fields.error_message}</div>
                  )}
                </div>
                <StatusBadge value={job.fields.job_status} variant="job_status" />
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Reports */}
      {reports.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Reports</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {reports.map((report) => (
              <GlassCard key={report.id} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="font-medium text-sm">Month {report.fields.month}</div>
                  {report.fields.pdf_url && (
                    <a
                      href={report.fields.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      PDF ↗
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className={`text-lg font-bold ${(report.fields.gsc_clicks_delta ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {(report.fields.gsc_clicks_delta ?? 0) >= 0 ? "+" : ""}{report.fields.gsc_clicks_delta ?? "—"}
                    </div>
                    <div className="text-white/30 text-xs">Clicks</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${(report.fields.gsc_impressions_delta ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {(report.fields.gsc_impressions_delta ?? 0) >= 0 ? "+" : ""}{report.fields.gsc_impressions_delta ?? "—"}
                    </div>
                    <div className="text-white/30 text-xs">Impressions</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-400">{report.fields.ai_citation_score ?? "—"}</div>
                    <div className="text-white/30 text-xs">AI Score</div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
