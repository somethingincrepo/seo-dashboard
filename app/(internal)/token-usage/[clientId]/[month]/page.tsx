import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseJob } from "@/lib/supabase";
import { getClients } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";
import { SopBreakdownTable } from "./SopBreakdownTable";

export const dynamic = "force-dynamic";

export type SopRow = {
  sopName: string;
  sopLabel: string;
  jobCount: number;
  failedCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  jobs: JobDetail[];
};

export type JobDetail = {
  id: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
  finishedAt: string | null;
};

const SOP_LABELS: Record<string, string> = {
  implement: "Implement Change",
  month1_audit: "Month 1 Audit",
  month1_implement: "Month 1 Implement",
  ongoing_implement: "Implement Change",
  ongoing_publish: "Publish SEO",
  ongoing_monthly: "Monthly Review",
  report_generate: "Generate Report",
  onboarding_setup: "Onboarding Setup",
};

function nextMonthStart(ym: string): string {
  const [year, mon] = ym.split("-").map(Number);
  if (mon === 12) return `${year + 1}-01-01T00:00:00Z`;
  return `${year}-${String(mon + 1).padStart(2, "0")}-01T00:00:00Z`;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatMonthLabel(ym: string): string {
  const [year, mon] = ym.split("-");
  return `${MONTH_LABELS[mon] ?? mon} ${year}`;
}

export default async function TokenUsageDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; month: string }>;
}) {
  const { clientId, month } = await params;

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, sop_name, status, input_tokens, output_tokens, cost_usd, created_at, finished_at")
    .eq("client_id", decodeURIComponent(clientId))
    .gte("created_at", `${month}-01T00:00:00Z`)
    .lt("created_at", nextMonthStart(month))
    .order("created_at", { ascending: false });

  if (error) notFound();

  const jobs = (data ?? []) as Pick<
    SupabaseJob,
    "id" | "sop_name" | "status" | "input_tokens" | "output_tokens" | "cost_usd" | "created_at" | "finished_at"
  >[];

  // Resolve client name
  const clients = await getClients();
  const client = clients.find(
    (c) => c.fields.client_id === decodeURIComponent(clientId)
  );
  const clientName = client?.fields.company_name ?? decodeURIComponent(clientId);

  // Group by sop_name
  const grouped = new Map<string, SopRow>();
  for (const job of jobs) {
    const sop = job.sop_name;
    if (!grouped.has(sop)) {
      grouped.set(sop, {
        sopName: sop,
        sopLabel: SOP_LABELS[sop] ?? sop.replace(/_/g, " "),
        jobCount: 0,
        failedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        jobs: [],
      });
    }
    const row = grouped.get(sop)!;
    row.jobCount++;
    row.inputTokens += job.input_tokens ?? 0;
    row.outputTokens += job.output_tokens ?? 0;
    row.costUsd += job.cost_usd ?? 0;
    if (job.status === "failed") row.failedCount++;
    row.jobs.push({
      id: job.id,
      status: job.status,
      inputTokens: job.input_tokens ?? 0,
      outputTokens: job.output_tokens ?? 0,
      costUsd: job.cost_usd ?? 0,
      createdAt: job.created_at,
      finishedAt: job.finished_at ?? null,
    });
  }

  const sopRows = [...grouped.values()].sort((a, b) => b.costUsd - a.costUsd);

  const totalCost = sopRows.reduce((s, r) => s + r.costUsd, 0);
  const totalInputTokens = sopRows.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = sopRows.reduce((s, r) => s + r.outputTokens, 0);
  const totalJobs = sopRows.reduce((s, r) => s + r.jobCount, 0);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/token-usage" className="hover:text-slate-600 transition-colors">
          Token Usage
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{clientName}</span>
        <span>/</span>
        <span className="text-slate-700 font-medium">{formatMonthLabel(month)}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{clientName}</h1>
        <p className="text-slate-500 text-sm mt-1">{formatMonthLabel(month)}</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Total Cost" value={fmtCost(totalCost)} accent="violet" />
        <Tile label="Total Jobs" value={totalJobs.toLocaleString()} accent="blue" />
        <Tile label="Input Tokens" value={fmtTokens(totalInputTokens)} accent="slate" />
        <Tile label="Output Tokens" value={fmtTokens(totalOutputTokens)} accent="emerald" />
      </div>

      {sopRows.length === 0 ? (
        <GlassCard>
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            No jobs found for this client in {formatMonthLabel(month)}.
          </div>
        </GlassCard>
      ) : (
        <SopBreakdownTable rows={sopRows} />
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "violet" | "blue" | "slate" | "emerald";
}) {
  const colors = {
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${colors[accent]}`}>
      <div className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
