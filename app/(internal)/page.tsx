import Link from "next/link";
import { getClients } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseJob } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

// Current month "YYYY-MM"
function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function nextMonthStart(ym: string): string {
  const [year, mon] = ym.split("-").map(Number);
  if (mon === 12) return `${year + 1}-01-01T00:00:00Z`;
  return `${year}-${String(mon + 1).padStart(2, "0")}-01T00:00:00Z`;
}

export default async function HomePage() {
  const ym = currentYearMonth();

  const [clients, pendingChanges, jobsThisMonth] = await Promise.all([
    getClients(),
    getPendingApprovals(),
    // Supabase: all jobs this calendar month
    getSupabase()
      .from("jobs")
      .select("client_id, status, cost_usd, sop_name, created_at")
      .gte("created_at", `${ym}-01T00:00:00Z`)
      .lt("created_at", nextMonthStart(ym))
      .order("created_at", { ascending: false })
      .then(({ data }) => (data ?? []) as Pick<SupabaseJob, "client_id" | "status" | "cost_usd" | "sop_name" | "created_at">[]),
  ]);

  // Pending approvals grouped by Airtable record ID
  const pendingByClientId = new Map<string, number>();
  for (const c of pendingChanges) {
    const cid = c.fields.client_id?.[0] ?? "__none__";
    pendingByClientId.set(cid, (pendingByClientId.get(cid) ?? 0) + 1);
  }

  // Jobs this month grouped by client slug
  type JobStats = { active: number; costUsd: number; lastSop: string; lastAt: string };
  const jobsBySlug = new Map<string, JobStats>();
  for (const j of jobsThisMonth) {
    const slug = j.client_id ?? "__none__";
    if (!jobsBySlug.has(slug)) {
      jobsBySlug.set(slug, { active: 0, costUsd: 0, lastSop: j.sop_name, lastAt: j.created_at });
    }
    const s = jobsBySlug.get(slug)!;
    s.costUsd += j.cost_usd ?? 0;
    if (["pending", "claimed", "running"].includes(j.status)) s.active++;
  }

  // Active clients only (skip offboarded/paused)
  const activeClients = clients.filter(
    (c) => !["offboarded", "paused", "churned"].includes(c.fields.status ?? "")
  );

  // Sort: pending approvals first → active jobs → alphabetical
  const sorted = activeClients.slice().sort((a, b) => {
    const aPending = pendingByClientId.get(a.id) ?? 0;
    const bPending = pendingByClientId.get(b.id) ?? 0;
    if (aPending !== bPending) return bPending - aPending;
    const aActive = (jobsBySlug.get(a.fields.client_id) ?? { active: 0 }).active;
    const bActive = (jobsBySlug.get(b.fields.client_id) ?? { active: 0 }).active;
    if (aActive !== bActive) return bActive - aActive;
    return a.fields.company_name.localeCompare(b.fields.company_name);
  });

  const totalPending = pendingChanges.length;
  const totalActive = jobsThisMonth.filter((j) =>
    ["pending", "claimed", "running"].includes(j.status)
  ).length;
  const totalCostMonth = jobsThisMonth.reduce((s, j) => s + (j.cost_usd ?? 0), 0);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Per-client status this month</p>
      </div>

      {/* Global summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryTile
          label="Pending Approvals"
          value={totalPending}
          accent={totalPending > 0 ? "amber" : "slate"}
          href="/activity?tab=approvals"
        />
        <SummaryTile
          label="Active Jobs"
          value={totalActive}
          accent={totalActive > 0 ? "blue" : "slate"}
          href="/activity?tab=jobs"
        />
        <SummaryTile
          label={`Cost — ${formatMonthLabel(ym)}`}
          value={`$${totalCostMonth.toFixed(4)}`}
          accent="violet"
          href="/token-usage"
          isString
        />
      </div>

      {/* Per-client grid */}
      <GlassCard>
        {/* Header */}
        <div className="grid grid-cols-[1fr_7rem_6rem_6rem_7rem_6rem] gap-x-4 px-5 py-2.5 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Approvals</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Active Jobs</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cost (mo.)</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Month</span>
        </div>

        <div className="divide-y divide-slate-100">
          {sorted.map((client) => {
            const pending = pendingByClientId.get(client.id) ?? 0;
            const jobs = jobsBySlug.get(client.fields.client_id);
            const active = jobs?.active ?? 0;
            const cost = jobs?.costUsd ?? 0;
            const monthNum = client.fields.month_number;

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="grid grid-cols-[1fr_7rem_6rem_6rem_7rem_6rem] gap-x-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
              >
                <div className="min-w-0 self-center">
                  <div className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                    {client.fields.company_name}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {client.fields.site_url?.replace(/^https?:\/\//, "")}
                  </div>
                </div>

                <div className="self-center">
                  <StatusDot status={client.fields.status || client.fields.plan_status} />
                </div>

                <div className="self-center text-center">
                  {pending > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                      {pending}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                <div className="self-center text-center">
                  {active > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                      {active}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                <div className="self-center text-right">
                  {cost > 0 ? (
                    <span className="text-xs font-medium text-slate-600 tabular-nums">
                      ${cost.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                <div className="self-center text-center">
                  {monthNum ? (
                    <span className="text-xs font-medium text-slate-500">M{monthNum}</span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              </Link>
            );
          })}

          {sorted.length === 0 && (
            <div className="px-5 py-12 text-center text-slate-400 text-sm">
              No active clients yet.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatMonthLabel(ym: string): string {
  const [year, mon] = ym.split("-");
  return `${MONTH_LABELS[mon] ?? mon} ${year}`;
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  active:            { dot: "bg-emerald-500", label: "Active" },
  onboarding:        { dot: "bg-blue-400",    label: "Onboarding" },
  awaiting_approval: { dot: "bg-amber-400",   label: "Awaiting" },
  paused:            { dot: "bg-slate-300",   label: "Paused" },
  offboarded:        { dot: "bg-slate-200",   label: "Offboarded" },
  churned:           { dot: "bg-red-300",     label: "Churned" },
};

function StatusDot({ status }: { status?: string }) {
  const s = STATUS_STYLES[status ?? ""] ?? { dot: "bg-slate-300", label: status ?? "—" };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
      <span className="text-xs text-slate-500 truncate">{s.label}</span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent,
  href,
  isString,
}: {
  label: string;
  value: number | string;
  accent: "amber" | "blue" | "violet" | "slate";
  href: string;
  isString?: boolean;
}) {
  const colors = {
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    slate: "bg-slate-50 border-slate-200 text-slate-500",
  };
  return (
    <Link
      href={href}
      className={`rounded-xl border px-5 py-4 hover:opacity-80 transition-opacity ${colors[accent]}`}
    >
      <div className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className={`font-semibold ${isString ? "text-xl" : "text-3xl"}`}>{value}</div>
    </Link>
  );
}
