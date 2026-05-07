import Link from "next/link";
import { airtableFetch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { GlassCard } from "@/components/ui/GlassCard";
import { RefireJobButtons } from "@/components/admin/RefireJobButtons";

export const dynamic = "force-dynamic";

type ClientRecord = {
  id: string;
  fields: {
    company_name?: string;
    plan_status?: string;
    portal_token?: string;
    package?: string;
  };
};

type JobRow = {
  id: string;
  sop_name: string;
  client_id: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  payload: Record<string, unknown> | null;
};

type RefreshRow = { client_id: string; status: string; proposed_at: string };

type LinkChangeRow = { id: string; fields: { client_id?: string | string[]; identified_at?: string } };

type ClientHealth = {
  id: string;
  company: string;
  plan_status: string;
  package: PackageTier;
  refresh_quota: number;
  link_quota: number;
  last_refresh_scheduler: JobRow | null;
  last_audit_internal_links: JobRow | null;
  refreshes_this_month: number;
  links_this_month: number;
  stuck_refreshes: number;
};

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function startOfWeekISO(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dayOfWeek + 1);
  return d.toISOString();
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function statusTone(status: string | null): string {
  switch (status) {
    case "done":
      return "text-green-600";
    case "failed":
      return "text-red-500";
    case "running":
    case "claimed":
      return "text-blue-500";
    case "pending":
      return "text-amber-500";
    default:
      return "text-slate-400";
  }
}

async function loadClientHealth(): Promise<ClientHealth[]> {
  const clients = await airtableFetch<ClientRecord>("Clients", {
    filterByFormula: `AND(OR({plan_status}="active",{plan_status}="month1_audit",{plan_status}="month1_audit_complete"),{portal_token}!="")`,
    fields: ["company_name", "plan_status", "portal_token", "package"],
    maxRecords: 200,
  });

  const ids = clients.map((c) => c.id);
  if (ids.length === 0) return [];

  const supabase = getSupabase();
  const monthStart = startOfMonthISO();
  const stuckCutoff = thirtyDaysAgoISO();

  // Fetch in parallel: jobs (last 90d), this-month refreshes, last-30d failed refreshes, internal-link Changes (this month).
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

  const [
    { data: jobsData },
    { data: refreshesData },
    { data: stuckData },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, sop_name, client_id, status, created_at, finished_at, error, payload")
      .in("sop_name", ["refresh_scheduler", "audit_internal_links"])
      .gte("created_at", ninetyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("content_refreshes")
      .select("client_id, status, proposed_at")
      .in("client_id", ids)
      .gte("proposed_at", monthStart)
      .limit(2000),
    supabase
      .from("content_refreshes")
      .select("client_id, status, proposed_at")
      .in("client_id", ids)
      .eq("status", "failed")
      .gte("proposed_at", stuckCutoff)
      .limit(2000),
  ]);

  const jobs = (jobsData ?? []) as JobRow[];
  const refreshes = (refreshesData ?? []) as RefreshRow[];
  const stuck = (stuckData ?? []) as RefreshRow[];

  // Latest refresh_scheduler per client. The cron mode runs with no client_id
  // (one global job processes all clients) — use that as the client's "last
  // refresh_scheduler" too if no client-scoped run is more recent.
  const latestGlobalRefresh = jobs.find((j) => j.sop_name === "refresh_scheduler" && !j.client_id) ?? null;

  const latestRefreshByClient = new Map<string, JobRow>();
  const latestLinksByClient = new Map<string, JobRow>();
  for (const j of jobs) {
    if (j.sop_name === "refresh_scheduler" && j.client_id) {
      if (!latestRefreshByClient.has(j.client_id)) latestRefreshByClient.set(j.client_id, j);
    } else if (j.sop_name === "audit_internal_links" && j.client_id) {
      if (!latestLinksByClient.has(j.client_id)) latestLinksByClient.set(j.client_id, j);
    }
  }

  const refreshCountByClient = new Map<string, number>();
  for (const r of refreshes) {
    refreshCountByClient.set(r.client_id, (refreshCountByClient.get(r.client_id) ?? 0) + 1);
  }
  const stuckCountByClient = new Map<string, number>();
  for (const r of stuck) {
    stuckCountByClient.set(r.client_id, (stuckCountByClient.get(r.client_id) ?? 0) + 1);
  }

  // Internal-link Changes this month — count via Airtable. The Changes table
  // uses `identified_at` (set by changes-writer.ts) not `created_at`.
  const changes = await airtableFetch<LinkChangeRow>("Changes", {
    filterByFormula: `AND({type}="Internal Link",IS_AFTER({identified_at},"${monthStart}"))`,
    fields: ["client_id", "identified_at"],
    maxRecords: 2000,
  });
  const linkCountByClient = new Map<string, number>();
  for (const c of changes) {
    const raw = c.fields.client_id;
    const cid = Array.isArray(raw) ? raw[0] : raw;
    if (!cid) continue;
    linkCountByClient.set(cid, (linkCountByClient.get(cid) ?? 0) + 1);
  }

  return clients.map((c) => {
    const pkgRaw = (c.fields.package ?? "growth").toLowerCase();
    const pkg: PackageTier = (["starter", "growth", "authority"].includes(pkgRaw) ? pkgRaw : "growth") as PackageTier;
    const perClientRefresh = latestRefreshByClient.get(c.id) ?? null;
    const lastRefresh =
      perClientRefresh && latestGlobalRefresh
        ? perClientRefresh.created_at > latestGlobalRefresh.created_at
          ? perClientRefresh
          : latestGlobalRefresh
        : perClientRefresh ?? latestGlobalRefresh;
    return {
      id: c.id,
      company: c.fields.company_name ?? c.id,
      plan_status: c.fields.plan_status ?? "",
      package: pkg,
      refresh_quota: PACKAGES[pkg].content_refreshes,
      link_quota: PACKAGES[pkg].internal_links,
      last_refresh_scheduler: lastRefresh,
      last_audit_internal_links: latestLinksByClient.get(c.id) ?? null,
      refreshes_this_month: refreshCountByClient.get(c.id) ?? 0,
      links_this_month: linkCountByClient.get(c.id) ?? 0,
      stuck_refreshes: stuckCountByClient.get(c.id) ?? 0,
    };
  });
}

export default async function RefreshHealthPage() {
  let rows: ClientHealth[] = [];
  let loadError: string | null = null;
  try {
    rows = await loadClientHealth();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  rows.sort((a, b) => a.company.localeCompare(b.company));
  const weekStart = startOfWeekISO();

  const refreshThisWeek = rows.filter(
    (r) => r.last_refresh_scheduler && r.last_refresh_scheduler.created_at >= weekStart,
  ).length;
  const linksThisWeek = rows.filter(
    (r) => r.last_audit_internal_links && r.last_audit_internal_links.created_at >= weekStart,
  ).length;
  const totalStuck = rows.reduce((sum, r) => sum + r.stuck_refreshes, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Refresh Health</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-client status of weekly content refreshes and internal-link batches. Re-fire
          a job for any client whose run failed or was missed.
        </p>
      </div>

      {loadError && (
        <GlassCard>
          <div className="px-5 py-4 text-sm text-red-500">Load error: {loadError}</div>
        </GlassCard>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile
          label="Active clients"
          value={String(rows.length)}
        />
        <SummaryTile
          label="Refresh runs this week"
          value={`${refreshThisWeek} / ${rows.length}`}
          tone={refreshThisWeek === rows.length ? "ok" : refreshThisWeek === 0 ? "err" : "warn"}
        />
        <SummaryTile
          label="Internal-link runs this week"
          value={`${linksThisWeek} / ${rows.length}`}
          tone={linksThisWeek === rows.length ? "ok" : linksThisWeek === 0 ? "err" : "warn"}
        />
      </section>

      {totalStuck > 0 && (
        <GlassCard className="border-amber-200">
          <div className="px-5 py-3 text-sm">
            <span className="font-medium text-amber-700">{totalStuck}</span>{" "}
            <span className="text-slate-600">
              stuck (failed) content refresh{totalStuck === 1 ? "" : "es"} in the last 30 days. Inspect
              individual rows below.
            </span>
          </div>
        </GlassCard>
      )}

      <section>
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-medium">Client</th>
                  <th className="text-left px-3 py-3 font-medium">Pkg</th>
                  <th className="text-left px-3 py-3 font-medium">Refreshes</th>
                  <th className="text-left px-3 py-3 font-medium">Links</th>
                  <th className="text-left px-3 py-3 font-medium">Last refresh job</th>
                  <th className="text-left px-3 py-3 font-medium">Last links job</th>
                  <th className="text-left px-3 py-3 font-medium">Stuck</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && !loadError && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                      No active clients found.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{r.company}</div>
                      <div className="text-[11px] text-slate-400">{r.plan_status}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 capitalize">{r.package}</td>
                    <td className="px-3 py-3">
                      <QuotaCell delivered={r.refreshes_this_month} quota={r.refresh_quota} />
                    </td>
                    <td className="px-3 py-3">
                      <QuotaCell delivered={r.links_this_month} quota={r.link_quota} />
                    </td>
                    <td className="px-3 py-3">
                      <JobCell job={r.last_refresh_scheduler} weekStart={weekStart} />
                    </td>
                    <td className="px-3 py-3">
                      <JobCell job={r.last_audit_internal_links} weekStart={weekStart} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.stuck_refreshes > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                          {r.stuck_refreshes}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RefireJobButtons clientId={r.id} companyName={r.company} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>

      <p className="text-xs text-slate-400">
        Backstop cron at{" "}
        <Link href="/jobs" className="underline hover:text-slate-600">
          /api/cron/weekly-health-check
        </Link>{" "}
        runs every Monday 13:00 UTC and re-fires any missing weekly job.
      </p>
    </div>
  );
}

function SummaryTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ok" | "warn" | "err" }) {
  const toneCls =
    tone === "ok"
      ? "text-green-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "err"
          ? "text-red-500"
          : "text-slate-800";
  return (
    <GlassCard>
      <div className="px-5 py-4">
        <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
      </div>
    </GlassCard>
  );
}

function QuotaCell({ delivered, quota }: { delivered: number; quota: number }) {
  const ratio = quota === 0 ? 0 : Math.min(1, delivered / quota);
  const tone = delivered >= quota ? "text-green-600" : delivered === 0 ? "text-slate-400" : "text-slate-700";
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm tabular-nums ${tone}`}>
        {delivered}
        <span className="text-slate-300"> / {quota}</span>
      </span>
      <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-300"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function JobCell({ job, weekStart }: { job: JobRow | null; weekStart: string }) {
  if (!job) return <span className="text-slate-300 text-xs">never</span>;
  const stale = job.created_at < weekStart;
  return (
    <Link href={`/jobs/${job.id}`} className="block hover:underline">
      <div className={`text-xs ${statusTone(job.status)}`}>
        <span className="font-medium uppercase tracking-wide">{job.status}</span>
        <span className="text-slate-400 ml-1">{fmtRelative(job.created_at)}</span>
      </div>
      {stale && (
        <div className="text-[10px] text-amber-600 mt-0.5">missed this week</div>
      )}
      {job.error && (
        <div className="text-[10px] text-red-400 line-clamp-1 mt-0.5">{job.error}</div>
      )}
    </Link>
  );
}
