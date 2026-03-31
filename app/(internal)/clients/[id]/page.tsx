import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/clients";
import { getClientJobs } from "@/lib/jobs";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { GenerateTokenButton } from "@/components/ui/GenerateTokenButton";

export const dynamic = "force-dynamic";

const CHANGE_TYPE_ICONS: Record<string, string> = {
  Metadata: "◈",
  Heading: "⌗",
  Schema: "◎",
  Content: "✎",
  FAQ: "?",
  Redirect: "↪",
  Removal: "✕",
  "Internal Link": "⌀",
  GEO: "✦",
  "Alt Text": "⊡",
  Canonical: "⊕",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://seo-dashboard-teal-phi.vercel.app";

  const [client, jobs, changes, reports] = await Promise.all([
    getClient(id),
    getClientJobs(id),
    getClientChanges(id),
    getClientReports(id),
  ]);

  if (!client) notFound();

  const f = client.fields;
  const portalUrl = f.portal_token ? `${baseUrl}/portal/${f.portal_token}` : null;

  // Split changes by approval state
  const pending = changes.filter((c) => c.fields.approval === "pending" || c.fields.approval_status === "pending");
  const approved = changes.filter((c) => c.fields.approval === "approved" || c.fields.approval_status === "approved");
  const skipped = changes.filter((c) => c.fields.approval === "skipped" || c.fields.approval_status === "skipped");

  // Group pending changes by category
  const byCategory: Record<string, typeof changes> = {};
  pending.forEach((c) => {
    const cat = c.fields.cat || c.fields.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/clients" className="text-white/40 text-sm hover:text-white/60 transition-colors">
          ← Clients
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-semibold">{f.company_name}</h1>
            {f.site_url && (
              <a href={f.site_url} target="_blank" rel="noreferrer"
                className="text-white/40 text-sm hover:text-white/60 transition-colors">
                {f.site_url} ↗
              </a>
            )}
          </div>
          <StatusBadge value={f.plan_status || "form_submitted"} variant="plan_status" />
        </div>
      </div>

      {/* Portal token — top priority */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Client Portal</div>
            {portalUrl ? (
              <div className="font-mono text-sm text-violet-300 break-all">{portalUrl}</div>
            ) : (
              <div className="text-sm text-amber-400/80">No portal token — generate one to give this client access</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {portalUrl && <CopyButton value={portalUrl} label="Copy link" size="lg" />}
            {portalUrl && (
              <a href={portalUrl} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs glass glass-hover text-white/60 hover:text-white transition-colors">
                Preview ↗
              </a>
            )}
            <GenerateTokenButton clientId={id} hasToken={!!f.portal_token} />
          </div>
        </div>
      </GlassCard>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{pending.length}</div>
          <div className="text-white/40 text-xs mt-1">Pending Approval</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{approved.length}</div>
          <div className="text-white/40 text-xs mt-1">Approved</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-400">{skipped.length}</div>
          <div className="text-white/40 text-xs mt-1">Skipped</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{jobs.length}</div>
          <div className="text-white/40 text-xs mt-1">Jobs Run</div>
        </GlassCard>
      </div>

      {/* Pending audit changes */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Pending Approvals
          </h2>

          {Object.keys(byCategory).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(byCategory).map(([cat, catChanges]) => (
                <GlassCard key={cat} className="overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
                    <StatusBadge value={cat} variant="category" />
                    <span className="text-white/40 text-xs">{catChanges.length} changes</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {catChanges.map((change) => {
                      const changeType = change.fields.type || change.fields.change_type || "";
                      return (
                        <div key={change.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="text-white/50">{CHANGE_TYPE_ICONS[changeType] || "·"}</span>
                                <span className="text-sm font-medium">{changeType}</span>
                                <StatusBadge value={change.fields.confidence || "Medium"} variant="confidence" />
                                {(change.fields.implementation_tier) && (
                                  <span className="text-xs text-violet-400/70 border border-violet-400/20 px-1.5 py-0.5 rounded-full">
                                    {change.fields.implementation_tier}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-white/30 font-mono mb-2 truncate">
                                {change.fields.page_url}
                              </div>
                              {change.fields.proposed_value && (
                                <div className="text-xs text-white/60 bg-white/5 rounded-lg px-3 py-2 border border-white/8 line-clamp-2">
                                  {change.fields.proposed_value}
                                </div>
                              )}
                              {change.fields.reasoning && (
                                <div className="text-xs text-white/30 mt-1.5 italic line-clamp-1">
                                  {change.fields.reasoning}
                                </div>
                              )}
                            </div>
                            <StatusBadge value="pending" variant="approval" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard>
              <div className="px-5 py-8 text-center text-white/30 text-sm">
                Run an audit to generate recommendations
              </div>
            </GlassCard>
          )}
        </section>
      )}

      {/* Implemented changes */}
      {approved.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Implemented ({approved.length})
          </h2>
          <GlassCard>
            <div className="divide-y divide-white/5">
              {approved.map((change) => (
                <div key={change.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-white/70 flex items-center gap-2">
                      <StatusBadge value={change.fields.cat || change.fields.category || "Other"} variant="category" />
                      <span>{change.fields.type || change.fields.change_type}</span>
                    </div>
                    <div className="text-xs text-white/30 font-mono mt-0.5 truncate">{change.fields.page_url}</div>
                  </div>
                  <StatusBadge value="approved" variant="approval" />
                </div>
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* Jobs */}
      <section>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Job History</h2>
        <GlassCard>
          <div className="divide-y divide-white/8">
            {jobs.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/30 text-sm">No jobs yet</div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">
                      {(job.fields.job_type || job.fields.type || "job")?.replace(/_/g, " ")}
                    </div>
                    <div className="text-white/30 text-xs mt-0.5">
                      {job.fields.started_at ? new Date(job.fields.started_at).toLocaleString() : "Queued"}
                    </div>
                    {job.fields.error_message && (
                      <div className="text-red-400 text-xs mt-1 line-clamp-1">{job.fields.error_message}</div>
                    )}
                  </div>
                  <StatusBadge value={job.fields.job_status || job.fields.status || "queued"} variant="job_status" />
                </div>
              ))
            )}
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
                <div className="flex items-center justify-between mb-4">
                  <div className="font-medium text-sm">Month {report.fields.month}</div>
                  {report.fields.pdf_url && (
                    <a href={report.fields.pdf_url} target="_blank" rel="noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
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
