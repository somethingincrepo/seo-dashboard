import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/clients";
import { getClientJobs } from "@/lib/jobs";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { getContentStyles } from "@/lib/content-styles";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { GenerateTokenButton } from "@/components/ui/GenerateTokenButton";
import { GenerateCredentialsButton } from "@/components/ui/GenerateCredentialsButton";
import { DeleteClientButton } from "@/components/ui/DeleteClientButton";
import { CmsCredentialsForm } from "@/components/ui/CmsCredentialsForm";
import { EngainLinkButton } from "@/components/ui/EngainLinkButton";
import { ContentStylesEditor } from "@/components/ui/ContentStylesEditor";
import { IntegrationsForm } from "@/components/ui/IntegrationsForm";
import { PACKAGE_LABELS, type PackageTier } from "@/lib/packages";

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

function getPageLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "") || "/";
    if (path === "/" || path === "") return "Homepage";
    return path
      .replace(/^\//, "")
      .replace(/\//g, " / ");
  } catch {
    return url || "Unknown";
  }
}

function isSitewide(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return !url || url.endsWith("/") && url.split("/").length <= 4;
  }
}

type AirtableChange = { id: string; fields: Record<string, string | number | boolean | null | undefined> };

function buildPageGroups(
  catChanges: AirtableChange[],
  navPages: string[]
): Array<{ url: string; label: string; isNav: boolean; isSite: boolean; changes: AirtableChange[] }> {
  const map = new Map<string, AirtableChange[]>();
  for (const c of catChanges) {
    const url = (c.fields.page_url as string) || "";
    if (!map.has(url)) map.set(url, []);
    map.get(url)!.push(c);
  }

  const groups = Array.from(map.entries()).map(([url, changes]) => ({
    url,
    label: getPageLabel(url),
    isNav: navPages.includes(url),
    isSite: isSitewide(url),
    changes,
  }));

  groups.sort((a, b) => {
    if (a.isSite !== b.isSite) return a.isSite ? -1 : 1;
    if (a.isNav !== b.isNav) return a.isNav ? -1 : 1;
    return b.changes.length - a.changes.length;
  });

  return groups;
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://seo-dashboard-teal-phi.vercel.app";

  // Fetch client first to get client_id slug
  const client = await getClient(id);
  if (!client) notFound();

  const f = client.fields;
  const clientId = f.client_id || id;
  const portalUrl = f.portal_token ? `${baseUrl}/portal/${f.portal_token}` : null;

  // Fetch data using client_id slug
  const [changes, reports, jobs, contentStylesData] = await Promise.all([
    getClientChanges(clientId),
    getClientReports(clientId),
    getClientJobs(clientId),
    getContentStyles(f.company_name),
  ]);

  // Split changes by approval state
  const pending = changes.filter((c) => c.fields.approval === "pending" || c.fields.approval_status === "pending");
  const approved = changes.filter((c) => c.fields.approval === "approved" || c.fields.approval_status === "approved");
  const skipped = changes.filter((c) => c.fields.approval === "skipped" || c.fields.approval_status === "skipped");

  // Group pending changes by category
  const byCategory: Record<string, typeof changes> = {};
  pending.forEach((c) => {
    const cat = (c.fields.cat || c.fields.category || "Other") as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  });

  const navPages: string[] = (() => {
    try {
      return JSON.parse((f.nav_pages as string) || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/clients" className="text-slate-500 text-sm hover:text-slate-600 transition-colors">
          ← Clients
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{f.company_name}</h1>
              {f.package && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  f.package === "starter"
                    ? "bg-slate-100 text-slate-600"
                    : f.package === "growth"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-violet-50 text-violet-700"
                }`}>
                  {PACKAGE_LABELS[f.package as PackageTier]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {f.site_url && (
                <a href={f.site_url} target="_blank" rel="noreferrer"
                  className="text-slate-500 text-sm hover:text-slate-600 transition-colors">
                  {f.site_url} ↗
                </a>
              )}
              {f.site_page_count ? (
                <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                  {f.site_page_count} pages
                </span>
              ) : null}
              {f.audit_scope_tier ? (
                <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                  Audit scope: {f.audit_scope_tier === "full" ? "Full site" : f.audit_scope_tier === "priority" ? "Priority (top 50)" : "Top traffic (top 100)"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge value={f.plan_status || "form_submitted"} variant="plan_status" />
            <DeleteClientButton clientId={id} clientName={f.company_name as string} />
          </div>
        </div>
      </div>

      {/* Portal token — top priority */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Client Portal</div>
            {portalUrl ? (
              <div className="font-mono text-sm text-indigo-600 break-all">{portalUrl}</div>
            ) : (
              <div className="text-sm text-amber-600">No portal token — generate one to give this client access</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {portalUrl && <CopyButton value={portalUrl} label="Copy link" size="lg" />}
            {portalUrl && (
              <a href={portalUrl} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                Preview ↗
              </a>
            )}
            <GenerateTokenButton clientId={id} hasToken={!!f.portal_token} />
          </div>
        </div>
      </GlassCard>

      {/* Portal credentials — username/password login */}
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Portal Login Credentials</div>
            {f.portal_username ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20 shrink-0">Username</span>
                  <span className="font-mono text-sm text-slate-800">{f.portal_username}</span>
                  <CopyButton value={f.portal_username} label="Copy" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20 shrink-0">Password</span>
                  <span className="font-mono text-sm text-slate-800">{f.portal_password || "—"}</span>
                  {f.portal_password && <CopyButton value={f.portal_password} label="Copy" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20 shrink-0">Login URL</span>
                  <span className="font-mono text-sm text-indigo-600">{baseUrl}/portal/login</span>
                  <CopyButton value={`${baseUrl}/portal/login`} label="Copy" />
                </div>
              </>
            ) : (
              <div className="text-sm text-amber-600">
                No credentials — this client was created before auto-generation was added.
              </div>
            )}
          </div>
          <GenerateCredentialsButton
            clientId={id}
            hasCredentials={!!f.portal_username}
          />
        </div>
      </GlassCard>

      {/* CMS credentials — only show for WordPress clients */}
      {f.cms?.toLowerCase() === "wordpress" && (
        <GlassCard className="p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">
            CMS Credentials
            <span className="ml-2 text-slate-400 normal-case font-normal">
              — used by the implement agent to write changes to WordPress
            </span>
          </div>
          <CmsCredentialsForm
            clientId={id}
            siteUrl={f.site_url || ""}
            initialValues={{
              wp_username: f.wp_username || "",
              wp_app_password: f.wp_app_password || "",
              seo_plugin: f.seo_plugin || "",
              page_builder: f.page_builder || "",
            }}
          />
        </GlassCard>
      )}

      {/* Reddit brand monitoring */}
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Reddit Monitoring
            </div>
            {f.engain_project_id ? (
              <div className="space-y-1">
                <div className="font-mono text-sm text-orange-600 break-all">{f.engain_project_id}</div>
                <Link
                  href={`/reddit/${id}`}
                  className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  View mentions →
                </Link>
              </div>
            ) : (
              <div className="text-sm text-amber-600">
                No project linked — connect a monitoring project to enable Reddit tracking
              </div>
            )}
          </div>
          <EngainLinkButton
            clientId={id}
            currentProjectId={f.engain_project_id || undefined}
          />
        </div>
      </GlassCard>

      {/* Integrations */}
      <GlassCard className="p-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">
          Integrations
          <span className="ml-2 text-slate-400 normal-case font-normal">
            — GSC, GA4, and Google Drive connection fields
          </span>
        </div>
        <IntegrationsForm
          clientId={id}
          initialValues={{
            gsc_property: f.gsc_property || "",
            ga4_property: f.ga4_property || "",
            sheet_id: f.sheet_id || "",
            drive_folder_id: f.drive_folder_id || "",
          }}
        />
      </GlassCard>

      {/* Content Styles */}
      <GlassCard className="p-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">
          Content Styles
          <span className="ml-2 text-slate-400 normal-case font-normal">
            — up to 3 styles that shape Claude&apos;s title writing for this client
          </span>
        </div>
        <ContentStylesEditor
          clientId={id}
          recordId={contentStylesData?.recordId ?? null}
          initialStyleIds={contentStylesData?.styleIds ?? []}
        />
      </GlassCard>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pending.length}</div>
          <div className="text-slate-500 text-xs mt-1">Pending Approval</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{approved.length}</div>
          <div className="text-slate-500 text-xs mt-1">Approved</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-400">{skipped.length}</div>
          <div className="text-slate-500 text-xs mt-1">Skipped</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{jobs.length}</div>
          <div className="text-slate-500 text-xs mt-1">Jobs Run</div>
        </GlassCard>
      </div>

      {/* Pending audit changes */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
            Pending Approvals
          </h2>

          {Object.keys(byCategory).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(byCategory).map(([cat, catChanges]) => {
                const pageGroups = buildPageGroups(catChanges as AirtableChange[], navPages);
                return (
                <GlassCard key={cat} className="overflow-hidden">
                  {/* Category header */}
                  <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                    <StatusBadge value={cat} variant="category" />
                    <span className="text-slate-500 text-xs">{catChanges.length} changes</span>
                    <span className="text-slate-400 text-xs">· {pageGroups.length} pages</span>
                  </div>

                  {/* Page groups */}
                  {pageGroups.map((group) => (
                    <div key={group.url} className="border-b border-slate-100 last:border-b-0">
                      {/* Page group header */}
                      <div className="px-5 py-2.5 bg-slate-50 flex items-center gap-2">
                        <span className="text-slate-400 text-xs">▸</span>
                        <span className="text-xs text-slate-600 font-mono flex-1 truncate">
                          {group.label}
                        </span>
                        {group.isNav && (
                          <span className="text-xs text-indigo-500 border border-indigo-200 px-1.5 py-0 rounded-full">nav</span>
                        )}
                        <span className="text-xs text-slate-400 tabular-nums">{group.changes.length}</span>
                      </div>

                      {/* Changes within page group */}
                      <div className="divide-y divide-slate-100">
                        {group.changes.map((change) => {
                          const changeType = (change.fields.type || change.fields.change_type || "") as string;
                          return (
                            <div key={change.id} className="px-5 py-3.5 pl-8">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <span className="text-slate-500">{CHANGE_TYPE_ICONS[changeType] || "·"}</span>
                                    <span className="text-sm font-medium">{changeType}</span>
                                    <StatusBadge value={(change.fields.confidence || "Medium") as string} variant="confidence" />
                                    {change.fields.implementation_tier && (
                                      <span className="text-xs text-indigo-500 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                                        {change.fields.implementation_tier as string}
                                      </span>
                                    )}
                                  </div>
                                  {change.fields.proposed_value && (
                                    <div className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 line-clamp-2">
                                      {change.fields.proposed_value as string}
                                    </div>
                                  )}
                                  {change.fields.reasoning && (
                                    <div className="text-xs text-slate-400 mt-1.5 italic line-clamp-1">
                                      {change.fields.reasoning as string}
                                    </div>
                                  )}
                                </div>
                                <StatusBadge value="pending" variant="approval" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </GlassCard>
                );
              })}
            </div>
          ) : (
            <GlassCard>
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                Run an audit to generate recommendations
              </div>
            </GlassCard>
          )}
        </section>
      )}

      {/* Implemented changes */}
      {approved.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
            Implemented ({approved.length})
          </h2>
          <GlassCard>
            <div className="divide-y divide-slate-100">
              {approved.map((change) => (
                <div key={change.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700 flex items-center gap-2">
                      <StatusBadge value={change.fields.cat || change.fields.category || "Other"} variant="category" />
                      <span>{change.fields.type || change.fields.change_type}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{change.fields.page_url}</div>
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
        <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Job History</h2>
        <GlassCard>
          <div className="divide-y divide-slate-100">
            {jobs.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No jobs yet</div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">
                      {(job.fields.job_type || job.fields.type || "job")?.replace(/_/g, " ")}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
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
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Reports</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {reports.map((report) => (
              <GlassCard key={report.id} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-medium text-sm">
                    {report.report_month_label ?? `Month ${report.month}`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className={`text-lg font-bold ${(report.gsc_clicks_delta ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(report.gsc_clicks_delta ?? 0) >= 0 ? "+" : ""}{report.gsc_clicks_delta ?? "—"}
                    </div>
                    <div className="text-slate-400 text-xs">Clicks</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${(report.gsc_impressions_delta ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(report.gsc_impressions_delta ?? 0) >= 0 ? "+" : ""}{report.gsc_impressions_delta ?? "—"}
                    </div>
                    <div className="text-slate-400 text-xs">Impressions</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${(report.ga4_sessions_delta ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(report.ga4_sessions_delta ?? 0) >= 0 ? "+" : ""}{report.ga4_sessions_delta ?? "—"}
                    </div>
                    <div className="text-slate-400 text-xs">Sessions</div>
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
