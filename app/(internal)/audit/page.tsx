import Link from "next/link";
import { listAuditRuns } from "@/lib/audit/queries";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, string> = {
  queued: "bg-slate-50 text-slate-600 ring-slate-200",
  crawling: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  crawled: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  diagnosing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  complete: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

export default async function AuditAdminIndex() {
  const runs = await listAuditRuns(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audits</h1>
        <p className="text-sm text-slate-500 mt-1">All deterministic audit runs across clients.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200/80">
            <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Root</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Trigger</th>
              <th className="px-4 py-2.5 font-semibold text-right">Pages</th>
              <th className="px-4 py-2.5 font-semibold text-right">Issues</th>
              <th className="px-4 py-2.5 font-semibold">Duration</th>
              <th className="px-4 py-2.5 font-semibold">Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  No audits yet.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/audit/${r.id}`} className="text-slate-900 font-medium hover:text-indigo-700">
                    {r.client_name || r.client_id}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-500 truncate max-w-xs">{r.root_url}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${STATUS_PILL[r.status] ?? STATUS_PILL.queued}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{r.triggered_by}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{r.pages_crawled}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{r.issues_found}</td>
                <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                  {fmtDuration(r.crawl_started_at, r.diagnose_completed_at ?? r.crawl_completed_at)}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {new Date(r.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
