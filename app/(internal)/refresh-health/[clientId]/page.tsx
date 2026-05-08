import Link from "next/link";
import { notFound } from "next/navigation";
import { airtableFetch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { TriggerAuditButton } from "@/components/admin/TriggerAuditButton";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientRecord = {
  id: string;
  fields: {
    company_name?: string;
    plan_status?: string;
    package?: string;
    site_url?: string;
  };
};

type JobRow = {
  id: string;
  sop_name: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
};

type AuditRunRow = {
  id: string;
  status: string;
  triggered_by: string;
  created_at: string;
  crawl_completed_at: string | null;
  diagnose_completed_at: string | null;
  pages_crawled: number;
  issues_found: number;
  error_message: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function statusBadge(status: string): string {
  switch (status) {
    case "done":
    case "complete":
      return "text-green-700 bg-green-50 border-green-200";
    case "failed":
      return "text-red-600 bg-red-50 border-red-200";
    case "running":
    case "claimed":
    case "crawling":
    case "crawled":
    case "diagnosing":
    case "queued":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "pending":
      return "text-amber-600 bg-amber-50 border-amber-200";
    default:
      return "text-slate-400 bg-slate-50 border-slate-200";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

const JOB_SECTIONS: { key: string; label: string; cadence: string }[] = [
  { key: "refresh_scheduler", label: "Content Refresh Scheduler", cadence: "weekly" },
  { key: "content_refresh", label: "Content Refresh (per page)", cadence: "weekly" },
  { key: "audit_internal_links", label: "Internal Links Audit", cadence: "weekly" },
  { key: "content_scheduler", label: "Title Scheduler", cadence: "weekly" },
  { key: "title_generation", label: "Title Generation", cadence: "weekly" },
  { key: "report_generate", label: "Monthly Report", cadence: "monthly" },
  { key: "keyword_research", label: "Keyword Research", cadence: "post-audit" },
  { key: "generate_content_profile", label: "Content Profile", cadence: "post-audit" },
];

export default async function ClientHealthPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  // Fetch client from Airtable
  let client: ClientRecord | null = null;
  try {
    const records = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: `RECORD_ID()="${clientId}"`,
      fields: ["company_name", "plan_status", "package", "site_url"],
      maxRecords: 1,
    });
    client = records[0] ?? null;
  } catch {
    // fall through
  }
  if (!client) notFound();

  const supabase = getSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 60);
  const sinceISO = since.toISOString();

  const [{ data: jobsData }, { data: auditData }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, sop_name, status, created_at, finished_at, error")
      .eq("client_id", clientId)
      .in("sop_name", JOB_SECTIONS.map((s) => s.key))
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("audit_runs")
      .select("id, status, triggered_by, created_at, crawl_completed_at, diagnose_completed_at, pages_crawled, issues_found, error_message")
      .eq("client_id", clientId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const jobs = (jobsData ?? []) as JobRow[];
  const auditRuns = (auditData ?? []) as AuditRunRow[];

  const jobsBySop = new Map<string, JobRow[]>();
  for (const j of jobs) {
    if (!jobsBySop.has(j.sop_name)) jobsBySop.set(j.sop_name, []);
    jobsBySop.get(j.sop_name)!.push(j);
  }

  const company = client.fields.company_name ?? clientId;
  const pkg = client.fields.package ?? "growth";

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/refresh-health" className="text-sm text-slate-400 hover:text-slate-700">
        ← Deliverable Health
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{company}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
            <span className="capitalize">{pkg}</span>
            <span className="text-slate-300">·</span>
            <span>{client.fields.plan_status}</span>
            {client.fields.site_url && (
              <>
                <span className="text-slate-300">·</span>
                <a
                  href={client.fields.site_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline text-slate-500"
                >
                  {client.fields.site_url.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </div>
        </div>
        <TriggerAuditButton clientId={clientId} companyName={company} />
      </div>

      {/* Technical audit history */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">Technical Site Audits</h2>
          <span className="text-xs text-slate-400">monthly · last 60 days</span>
        </div>
        <GlassCard>
          {auditRuns.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400 text-center">
              No audit runs in the last 60 days.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditRuns.map((run) => (
                <div key={run.id} className="px-5 py-3 flex items-start gap-4">
                  <div className={`shrink-0 mt-0.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${statusBadge(run.status)}`}>
                    {run.status}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-700 font-medium">
                      {fmtRelative(run.created_at)}
                      <span className="text-slate-400 font-normal ml-2">· {run.triggered_by}</span>
                    </div>
                    {run.status === "complete" && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {run.pages_crawled} pages · {run.issues_found} issues ·
                        crawl {fmtDuration(run.created_at, run.crawl_completed_at)} ·
                        diagnose {fmtDuration(run.crawl_completed_at, run.diagnose_completed_at)}
                      </div>
                    )}
                    {run.error_message && (
                      <div className="mt-1 text-xs text-red-600 font-mono bg-red-50 rounded px-2 py-1 line-clamp-2">
                        {run.error_message}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/audit/${run.id}`}
                    className="shrink-0 text-xs text-blue-500 hover:underline whitespace-nowrap"
                  >
                    View issues →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>

      {/* Per-SOP job history */}
      {JOB_SECTIONS.map(({ key, label, cadence }) => {
        const rows = jobsBySop.get(key) ?? [];
        return (
          <section key={key}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">{cadence}</span>
                <span className="text-xs text-slate-300 font-mono">{key}</span>
              </div>
            </div>
            <GlassCard>
              {rows.length === 0 ? (
                <div className="px-5 py-5 text-xs text-slate-400 text-center">
                  No jobs in the last 60 days.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rows.map((job) => (
                    <div key={job.id} className="px-5 py-3 flex items-start gap-4">
                      <div className={`shrink-0 mt-0.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${statusBadge(job.status)}`}>
                        {job.status}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-600">
                          {fmtRelative(job.created_at)}
                          {job.finished_at && (
                            <span className="text-slate-400 ml-2">
                              · {fmtDuration(job.created_at, job.finished_at)}
                            </span>
                          )}
                        </div>
                        {job.error && (
                          <div className="mt-1 text-xs text-red-600 font-mono bg-red-50 rounded px-2 py-1 line-clamp-3">
                            {job.error}
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="shrink-0 text-xs text-blue-500 hover:underline whitespace-nowrap"
                      >
                        View logs →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </section>
        );
      })}
    </div>
  );
}
