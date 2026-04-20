import { getSupabase } from "@/lib/supabase";
import type { SupabaseJob } from "@/lib/supabase";
import { getClients } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";
import { TokenUsageTable } from "./TokenUsageTable";

export const dynamic = "force-dynamic";

export type JobSummary = {
  id: string;
  sopName: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
};

export type MonthlyClientRow = {
  clientId: string;
  clientName: string;
  month: string;       // "2026-04"
  monthLabel: string;  // "Apr 2026"
  jobCount: number;
  failedCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  jobs: JobSummary[];
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatMonthLabel(ym: string): string {
  const [year, mon] = ym.split("-");
  return `${MONTH_LABELS[mon] ?? mon} ${year}`;
}

async function getTokenUsageData(): Promise<MonthlyClientRow[]> {
  const supabase = getSupabase();

  // Fetch last 500 jobs — enough history without overloading
  const { data, error } = await supabase
    .from("jobs")
    .select("id, sop_name, client_id, status, input_tokens, output_tokens, cost_usd, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  const jobs = data as Pick<
    SupabaseJob,
    "id" | "sop_name" | "client_id" | "status" | "input_tokens" | "output_tokens" | "cost_usd" | "created_at"
  >[];

  // Fetch all clients for name lookup
  const clients = await getClients();
  // Jobs store client_id as the slug (c.fields.client_id), not the Airtable record ID (c.id)
  const clientNames = new Map<string, string>(
    clients.map((c) => [c.fields.client_id, c.fields.company_name])
  );

  // Aggregate by clientId + YYYY-MM
  const grouped = new Map<string, MonthlyClientRow>();

  for (const job of jobs) {
    const month = job.created_at.slice(0, 7); // "YYYY-MM"
    const cid = job.client_id ?? "__none__";
    const key = `${cid}::${month}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        clientId: cid,
        clientName: clientNames.get(cid) ?? (cid === "__none__" ? "— no client —" : cid),
        month,
        monthLabel: formatMonthLabel(month),
        jobCount: 0,
        failedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        jobs: [],
      });
    }

    const row = grouped.get(key)!;
    row.jobCount++;
    row.inputTokens += job.input_tokens ?? 0;
    row.outputTokens += job.output_tokens ?? 0;
    row.costUsd += job.cost_usd ?? 0;
    if (job.status === "failed") row.failedCount++;
    row.jobs.push({
      id: job.id,
      sopName: job.sop_name,
      status: job.status,
      inputTokens: job.input_tokens ?? 0,
      outputTokens: job.output_tokens ?? 0,
      costUsd: job.cost_usd ?? 0,
      createdAt: job.created_at,
    });
  }

  // Sort: newest month first, then alphabetically by client within month
  return [...grouped.values()].sort((a, b) => {
    if (b.month !== a.month) return b.month.localeCompare(a.month);
    return a.clientName.localeCompare(b.clientName);
  });
}

export default async function TokenUsagePage() {
  const rows = await getTokenUsageData();

  const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);
  const totalJobs = rows.reduce((s, r) => s + r.jobCount, 0);
  const totalInputTokens = rows.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = rows.reduce((s, r) => s + r.outputTokens, 0);

  // Unique months for the filter dropdown
  const months = [...new Set(rows.map((r) => r.month))].sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Token Usage</h1>
        <p className="text-slate-500 text-sm mt-1">
          Claude API token consumption and estimated cost per client per month
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile
          label="Total Cost"
          value={`$${totalCost.toFixed(4)}`}
          accent="violet"
        />
        <SummaryTile
          label="Total Jobs"
          value={totalJobs.toLocaleString()}
          accent="blue"
        />
        <SummaryTile
          label="Input Tokens"
          value={fmtTokens(totalInputTokens)}
          accent="slate"
        />
        <SummaryTile
          label="Output Tokens"
          value={fmtTokens(totalOutputTokens)}
          accent="emerald"
        />
      </div>

      {rows.length === 0 ? (
        <GlassCard>
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            No job data found in Supabase.
          </div>
        </GlassCard>
      ) : (
        <TokenUsageTable rows={rows} months={months} />
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function SummaryTile({
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
