import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 0;

function Delta({ value, label }: { value: number | undefined; label: string }) {
  const isPositive = (value ?? 0) >= 0;
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

  const clientId = client.fields.client_id || client.id;

  const reports = await getClientReports(clientId);
  const status = client.fields.status || client.fields.plan_status;
  const isOnboarding = ["form_submitted", "onboarding_setup", "month1_audit", "awaiting_approval", "month1_implementing"].includes(status);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white/90">Reports</h1>
        <p className="text-base text-white/40 mt-1">Monthly performance summaries</p>
      </div>

      {reports.length === 0 && (
        <GlassCard className="p-12 text-center">
          <div className="text-3xl mb-4 text-white/20">◎</div>
          <div className="font-medium text-white/70 mb-2">No reports yet</div>
          <div className="text-sm text-white/40 max-w-xs mx-auto">
            {isOnboarding
              ? "Your first monthly report will be ready after Month 1 optimizations are complete."
              : "Reports will appear here after your first monthly cycle."}
          </div>
        </GlassCard>
      )}

      <div className="space-y-4">
        {reports.map((report) => {
          const priorities = report.fields.next_month_priorities
            ? report.fields.next_month_priorities.split("\n").filter(Boolean)
            : [];

          return (
            <GlassCard key={report.id} className="overflow-hidden">
              <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-white/90">Month {report.fields.month}</div>
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
                    <a href={report.fields.pdf_url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/20 text-violet-300 hover:bg-violet-500/30 transition-all duration-150">
                      PDF ↗
                    </a>
                  )}
                </div>
              </div>

              <div className="p-5 grid grid-cols-3 gap-6">
                <Delta value={report.fields.gsc_clicks_delta} label="Clicks" />
                <Delta value={report.fields.gsc_impressions_delta} label="Impressions" />
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">{report.fields.ai_citation_score ?? "—"}</div>
                  <div className="text-white/30 text-xs mt-0.5">AI Citation Score</div>
                </div>
              </div>

              {priorities.length > 0 && (
                <div className="px-5 pb-5">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Next month</div>
                  <ul className="space-y-1">
                    {priorities.map((p, i) => (
                      <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                        <span className="text-violet-400 mt-0.5 flex-shrink-0">·</span>
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
