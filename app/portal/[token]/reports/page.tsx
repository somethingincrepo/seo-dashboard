import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientByToken } from "@/lib/clients";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 3600;

function Delta({ value, label }: { value: number | undefined; label: string }) {
  const val = value ?? 0;
  const isPositive = val >= 0;
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
        {isPositive ? "+" : ""}{value ?? "—"}
      </div>
      <div className="text-white/30 text-xs mt-0.5">{label}</div>
    </div>
  );
}

export default async function PortalReportsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const reports = await getClientReports(client.id);

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{client.fields.company_name}</div>
          <div className="text-white/35 text-xs">Monthly Reports</div>
        </div>
        <Link href={`/portal/${token}`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          ← Approvals
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-semibold">Monthly Reports</h1>

        {reports.length === 0 && (
          <GlassCard className="p-12 text-center">
            <div className="text-white/30 text-sm">No reports yet. Your first report will appear here after Month 1.</div>
          </GlassCard>
        )}

        {reports.map((report) => {
          const priorities = report.fields.next_month_priorities
            ? report.fields.next_month_priorities.split("\n").filter(Boolean)
            : [];

          return (
            <GlassCard key={report.id} className="overflow-hidden">
              <div className="p-5 border-b border-white/8 flex items-center justify-between">
                <div>
                  <div className="font-semibold">Month {report.fields.month}</div>
                  {report.fields.sent_at && (
                    <div className="text-white/30 text-xs mt-0.5">
                      {new Date(report.fields.sent_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {report.fields.changes_made > 0 && (
                    <span className="text-xs text-white/40">{report.fields.changes_made} changes implemented</span>
                  )}
                  {report.fields.pdf_url && (
                    <a
                      href={report.fields.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/20 text-violet-300 hover:bg-violet-500/30 transition-all"
                    >
                      PDF Report ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="p-5 grid grid-cols-3 gap-4">
                <Delta value={report.fields.gsc_clicks_delta} label="Clicks" />
                <Delta value={report.fields.gsc_impressions_delta} label="Impressions" />
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">{report.fields.ai_citation_score ?? "—"}</div>
                  <div className="text-white/30 text-xs mt-0.5">AI Citation Score</div>
                </div>
              </div>

              {/* Next month priorities */}
              {priorities.length > 0 && (
                <div className="px-5 pb-5">
                  <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Next month priorities</div>
                  <ul className="space-y-1">
                    {priorities.map((p, i) => (
                      <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                        <span className="text-violet-400 mt-0.5">·</span>
                        {p.replace(/^[-•·*]\s*/, "")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
