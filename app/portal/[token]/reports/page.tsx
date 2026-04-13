import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientReports, type Report } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDelta(
  value: number | null | undefined,
  reverse = false
): { display: string; color: string } {
  if (value == null) return { display: "—", color: "text-slate-400" };
  const positive = reverse ? value <= 0 : value >= 0;
  const color = positive ? "text-emerald-600" : "text-red-500";
  const display = value >= 0 ? `+${value}` : `${value}`;
  return { display, color };
}

function fmtNum(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionDivider() {
  return <div className="border-t border-slate-100 mx-5" />;
}

function MetricBlock({
  label,
  value,
  delta,
  pct,
  reverseColor = false,
}: {
  label: string;
  value?: number | null;
  delta?: number | null;
  pct?: string | null;
  reverseColor?: boolean;
}) {
  const d = fmtDelta(delta, reverseColor);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </div>
      {value != null && (
        <div className="text-2xl font-bold tabular-nums text-slate-900">{fmtNum(value)}</div>
      )}
      {delta != null && (
        <div className={`text-sm font-medium mt-0.5 ${d.color}`}>
          {d.display}
          {pct ? ` (${pct})` : ""}
        </div>
      )}
      {value == null && delta == null && (
        <div className="text-2xl font-bold text-slate-300">—</div>
      )}
    </div>
  );
}

type RankingGain = {
  keyword: string;
  prior_position: number;
  current_position: number;
  change: number;
};
type RankingOpportunity = { keyword: string; position: number; impressions: number };
type AiSource = { source: string; sessions_this: number; sessions_prior: number };

// ─── Report Card ─────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: Report }) {
  const f = report.fields;

  const rankingGains = parseJson<RankingGain[]>(f.top_ranking_gains);
  const rankingOpps = parseJson<RankingOpportunity[]>(f.ranking_opportunities);
  const aiSources = parseJson<AiSource[]>(f.ga4_ai_by_source);

  const priorities = f.next_month_priorities
    ? f.next_month_priorities.split("\n").filter(Boolean)
    : [];
  const notableLines = f.notable_changes
    ? f.notable_changes.split("\n").filter(Boolean)
    : [];

  const hasGsc = f.gsc_clicks_this != null || f.gsc_clicks_delta != null;
  const hasGa4 = f.ga4_sessions_this != null;
  const hasAiTraffic = f.ga4_ai_sessions_this != null;
  const hasRankingGains = rankingGains && rankingGains.length > 0;
  const hasRankingOpps = rankingOpps && rankingOpps.length > 0;

  const reportDate = f.report_generated_at
    ? new Date(f.report_generated_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <GlassCard className="overflow-hidden">
      {/* ── Header ── */}
      <div className="p-5 flex items-start justify-between">
        <div>
          <div className="text-xl font-bold text-slate-900">
            {f.report_month_label ?? `Month ${f.month}`}
          </div>
          {reportDate && (
            <div className="text-slate-400 text-xs mt-0.5">Generated {reportDate}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {f.changes_made > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium">
              {f.changes_made} changes implemented
            </span>
          )}
          {f.skipped_count > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
              {f.skipped_count} skipped
            </span>
          )}
        </div>
      </div>

      {/* ── GSC + GA4 Performance ── */}
      {(hasGsc || hasGa4) && (
        <>
          <SectionDivider />
          <div className="p-5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Search Performance
            </div>
            <div className="grid grid-cols-2 gap-8">
              {/* GSC */}
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-3">
                  Google Search Console
                </div>
                {hasGsc ? (
                  <div className="grid grid-cols-3 gap-4">
                    <MetricBlock
                      label="Clicks"
                      value={f.gsc_clicks_this}
                      delta={f.gsc_clicks_delta}
                      pct={f.gsc_clicks_pct}
                    />
                    <MetricBlock label="Impressions" delta={f.gsc_impressions_delta} />
                    <MetricBlock
                      label="Avg Pos"
                      delta={
                        f.gsc_avg_position_delta != null
                          ? Math.round(f.gsc_avg_position_delta * 10) / 10
                          : null
                      }
                      reverseColor
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not connected</p>
                )}
              </div>

              {/* GA4 */}
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-3">
                  Google Analytics
                </div>
                {hasGa4 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <MetricBlock
                      label="Sessions"
                      value={f.ga4_sessions_this}
                      delta={f.ga4_sessions_delta}
                    />
                    <MetricBlock
                      label="Users"
                      value={f.ga4_users_this}
                      delta={f.ga4_users_delta}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not connected</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── AI Referral Traffic ── */}
      {hasAiTraffic && (
        <>
          <SectionDivider />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                AI Referral Traffic
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 border border-violet-100 text-violet-600 font-medium">
                AI
              </span>
            </div>

            {(f.ga4_ai_sessions_this ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">
                No AI referral traffic detected this month. As your content builds topical
                authority, sessions from ChatGPT, Perplexity, Claude, and Gemini will appear here.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-baseline gap-6">
                  <div>
                    <span className="text-2xl font-bold tabular-nums text-violet-700">
                      {fmtNum(f.ga4_ai_sessions_this)}
                    </span>
                    <span className="text-sm text-slate-500 ml-1.5">sessions from AI platforms</span>
                  </div>
                  {f.ga4_ai_sessions_delta != null && (
                    <div
                      className={`text-sm font-medium ${fmtDelta(f.ga4_ai_sessions_delta).color}`}
                    >
                      {fmtDelta(f.ga4_ai_sessions_delta).display} vs prior month
                    </div>
                  )}
                </div>

                {aiSources && aiSources.length > 0 && (
                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Source
                          </th>
                          <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            This month
                          </th>
                          <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            vs prior
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {aiSources.map((s) => {
                          const delta = s.sessions_this - (s.sessions_prior ?? 0);
                          const d = fmtDelta(delta);
                          const isNew = s.sessions_prior === 0 && s.sessions_this > 0;
                          return (
                            <tr key={s.source} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-700 font-medium">{s.source}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-900 font-semibold">
                                {fmtNum(s.sessions_this)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {isNew ? (
                                  <span className="text-violet-600 font-medium text-xs">new</span>
                                ) : (
                                  <span className={`${d.color} font-medium`}>{d.display}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Notable Changes ── */}
      {notableLines.length > 0 && (
        <>
          <SectionDivider />
          <div className="p-5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Notable Changes
            </div>
            <ul className="space-y-1.5">
              {notableLines.map((line, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">✓</span>
                  {line.replace(/^[-•·*✓]\s*/, "")}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ── Ranking Wins & Opportunities ── */}
      {(hasRankingGains || hasRankingOpps) && (
        <>
          <SectionDivider />
          <div className="p-5 grid grid-cols-2 gap-6">
            {hasRankingGains && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Ranking Wins
                </div>
                <div className="space-y-2">
                  {rankingGains!.slice(0, 5).map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate mr-3 flex-1">{g.keyword}</span>
                      <span className="text-emerald-600 font-semibold whitespace-nowrap">
                        ↑{Math.abs(g.change)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasRankingOpps && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Quick Win Opportunities
                </div>
                <div className="space-y-2">
                  {rankingOpps!.slice(0, 5).map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate mr-3 flex-1">{o.keyword}</span>
                      <span className="text-amber-600 font-medium whitespace-nowrap">
                        #{Math.round(o.position)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Next Month Priorities ── */}
      {priorities.length > 0 && (
        <>
          <SectionDivider />
          <div className="p-5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Next Month&rsquo;s Focus
            </div>
            <ol className="space-y-1.5">
              {priorities.map((p, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
                  <span className="text-indigo-500 font-semibold flex-shrink-0 mt-0.5 w-4">
                    {i + 1}.
                  </span>
                  {p.replace(/^\d+\.\s*/, "")}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </GlassCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PortalReportsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const reports = await getClientReports(clientId);

  const status = client.fields.status || client.fields.plan_status;
  const isOnboarding = [
    "form_submitted",
    "onboarding_setup",
    "month1_audit",
    "awaiting_approval",
    "month1_implementing",
  ].includes(status);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="text-base text-slate-500 mt-1">Monthly performance summaries</p>
      </div>

      {reports.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-3xl mb-4 text-slate-300">◎</div>
          <div className="font-medium text-slate-700 mb-2">No reports yet</div>
          <div className="text-sm text-slate-500 max-w-xs mx-auto">
            {isOnboarding
              ? "Your first monthly report will be ready after Month 1 optimizations are complete."
              : "Reports will appear here after your first monthly cycle."}
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
