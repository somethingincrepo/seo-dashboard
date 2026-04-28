import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuditRun, getIssuesForRun, listAuditRuns } from "@/lib/audit/queries";
import { AuditRepeatabilityPanel } from "@/components/admin/AuditRepeatabilityPanel";

export const dynamic = "force-dynamic";

export default async function AuditRunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getAuditRun(id);
  if (!run) notFound();

  const [issues, allRuns] = await Promise.all([
    getIssuesForRun(id),
    listAuditRuns(50),
  ]);
  const clientRuns = allRuns.filter((r) => r.client_id === run.client_id && r.id !== run.id).slice(0, 5);

  // Severity breakdown
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
  const catCounts: Record<string, number> = {};
  for (const i of issues) {
    sevCounts[i.severity] = (sevCounts[i.severity] ?? 0) + 1;
    catCounts[i.category] = (catCounts[i.category] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/audit" className="text-xs text-slate-500 hover:text-slate-900">← All audits</Link>
        <div className="flex items-baseline gap-3 mt-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{run.client_name}</h1>
          <span className="text-sm text-slate-500">{run.root_url}</span>
        </div>
        <div className="flex gap-2 mt-2 text-xs text-slate-500">
          <span>Run ID <code className="font-mono">{run.id}</code></span>
          <span>·</span>
          <span>Status <strong className="text-slate-700">{run.status}</strong></span>
          <span>·</span>
          <span>Trigger {run.triggered_by}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Pages crawled" value={run.pages_crawled.toLocaleString()} />
        <Stat label="Issues found" value={run.issues_found.toLocaleString()} />
        <Stat label="Crawl time" value={fmtDuration(run.crawl_started_at, run.crawl_completed_at)} />
        <Stat label="Diagnose time" value={fmtDuration(run.diagnose_started_at, run.diagnose_completed_at)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="By severity">
          <Bars data={[
            { label: "Critical", count: sevCounts.critical, color: "bg-rose-500" },
            { label: "High", count: sevCounts.high, color: "bg-orange-500" },
            { label: "Medium", count: sevCounts.medium, color: "bg-amber-400" },
            { label: "Low", count: sevCounts.low, color: "bg-emerald-400" },
          ]} />
        </Card>
        <Card title="By category">
          <Bars data={[
            { label: "Technical", count: catCounts.technical ?? 0, color: "bg-indigo-500" },
            { label: "On-Page", count: catCounts["on-page"] ?? 0, color: "bg-violet-500" },
            { label: "Content", count: catCounts.content ?? 0, color: "bg-sky-500" },
            { label: "AI-GEO", count: catCounts["ai-geo"] ?? 0, color: "bg-emerald-500" },
          ]} />
        </Card>
      </div>

      <AuditRepeatabilityPanel run={run} priorRuns={clientRuns} currentIssues={issues} />

      {run.error_message && (
        <Card title="Error">
          <pre className="font-mono text-xs text-rose-700 bg-rose-50 p-3 rounded border border-rose-200/70 whitespace-pre-wrap">
            {run.error_message}
          </pre>
        </Card>
      )}

      <Card title={`Issues (${issues.length})`}>
        <div className="max-h-[60vh] overflow-y-auto -mx-3">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-slate-400 sticky top-0 bg-white">
              <tr>
                <th className="px-3 py-2 font-semibold">Severity</th>
                <th className="px-3 py-2 font-semibold">Rule</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Page</th>
                <th className="px-3 py-2 font-semibold">Current</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sevPill(i.severity)}`}>{i.severity}</span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-700"><code className="font-mono text-[11px] text-slate-500 mr-1.5">{i.rule_id}</code>{i.rule_name}</td>
                  <td className="px-3 py-1.5 text-slate-500">{i.category}</td>
                  <td className="px-3 py-1.5 text-slate-500 max-w-xs truncate">{i.scope === "site" ? "—" : i.page_url}</td>
                  <td className="px-3 py-1.5 text-slate-500 max-w-xs truncate font-mono text-[11px]">{i.current_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3">
      <div className="text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
      <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Bars({ data }: { data: { label: string; count: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <div className="w-20 text-xs text-slate-600">{d.label}</div>
          <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
            <div className={`h-full ${d.color}`} style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <div className="w-10 text-xs text-slate-500 tabular-nums text-right">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

function fmtDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function sevPill(sev: string): string {
  switch (sev) {
    case "critical": return "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/70";
    case "high": return "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200/70";
    case "medium": return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70";
    default: return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70";
  }
}
