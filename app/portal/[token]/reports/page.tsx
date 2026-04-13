import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientReports } from "@/lib/reports";
import type { SupabaseReport, TrendEntry, RankingEntry, PageEntry, AiSourceEntry } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDelta(value: number | null | undefined, reverse = false) {
  if (value == null) return { display: "—", color: "text-slate-400" };
  const positive = reverse ? value <= 0 : value >= 0;
  return {
    display: value >= 0 ? `+${value}` : `${value}`,
    color: positive ? "text-emerald-600" : "text-red-500",
  };
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPos(n: number | null | undefined) {
  if (n == null) return "—";
  return `#${n.toFixed(1)}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-slate-100 mx-5" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </div>
  );
}

function MetricCell({
  label, value, delta, pct, sub, reverseColor = false,
}: {
  label: string;
  value?: number | null;
  delta?: number | null;
  pct?: string | null;
  sub?: string | null;
  reverseColor?: boolean;
}) {
  const d = fmtDelta(delta, reverseColor);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      {value != null ? (
        <div className="text-xl font-bold tabular-nums text-slate-900">{fmtNum(value)}</div>
      ) : delta != null ? (
        <div className={`text-xl font-bold tabular-nums ${d.color}`}>{d.display}</div>
      ) : (
        <div className="text-xl font-bold text-slate-300">—</div>
      )}
      {delta != null && value != null && (
        <div className={`text-xs font-medium mt-0.5 ${d.color}`}>
          {d.display}{pct ? ` (${pct})` : ""}
        </div>
      )}
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function TrendBar({ trend }: { trend: TrendEntry[] }) {
  const maxClicks = Math.max(...trend.map((t) => t.clicks), 1);
  return (
    <div className="flex items-end gap-3 h-10">
      {trend.map((t) => (
        <div key={t.month_label} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full bg-indigo-200 rounded-t-sm"
            style={{ height: `${Math.round((t.clicks / maxClicks) * 32)}px`, minHeight: "4px" }}
          />
          <div className="text-[10px] text-slate-400 whitespace-nowrap">
            {t.month_label.split(" ")[0]}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Report Card ─────────────────────────────────────────────────────────────

function ReportCard({ report: r }: { report: SupabaseReport }) {
  const hasGsc = r.gsc_clicks_this != null || r.gsc_clicks_delta != null;
  const hasGa4 = r.ga4_sessions_this != null;
  const hasAiTraffic = r.ga4_ai_sessions_this != null;
  const hasTrend = r.gsc_3month_trend && r.gsc_3month_trend.length > 0;
  const hasRankingGains = r.top_ranking_gains && r.top_ranking_gains.length > 0;
  const hasRankingLosses = r.top_ranking_losses && r.top_ranking_losses.length > 0;
  const hasTopPages = r.top_pages_growth && r.top_pages_growth.length > 0;
  const hasTopLoss = r.top_pages_loss && r.top_pages_loss.length > 0;
  const hasContent = (r.articles_published?.length ?? 0) > 0 || (r.articles_now_ranking?.length ?? 0) > 0;
  const hasTechnical = (r.pages_optimized?.length ?? 0) > 0;
  const hasAiGeo = r.entity_coverage_score != null || (r.ai_mentions?.length ?? 0) > 0;

  const reportDate = r.report_generated_at
    ? new Date(r.report_generated_at).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  const priorities = r.next_month_priorities
    ? r.next_month_priorities.split("\n").filter(Boolean)
    : [];

  return (
    <GlassCard className="overflow-hidden">

      {/* ── Header ── */}
      <div className="p-5 flex items-start justify-between">
        <div>
          <div className="text-xl font-bold text-slate-900">
            {r.report_month_label ?? `Month ${r.month}`}
          </div>
          {reportDate && <div className="text-slate-400 text-xs mt-0.5">Generated {reportDate}</div>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {r.changes_made > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium">
              {r.changes_made} changes implemented
            </span>
          )}
          {(r.skipped_count ?? 0) > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
              {r.skipped_count} skipped
            </span>
          )}
        </div>
      </div>

      {/* ── Narrative ── */}
      {r.narrative && (
        <>
          <Divider />
          <div className="px-5 py-4 bg-slate-50/60">
            <p className="text-sm text-slate-700 leading-relaxed">{r.narrative}</p>
          </div>
        </>
      )}

      {/* ── Search Performance ── */}
      {(hasGsc || hasGa4) && (
        <>
          <Divider />
          <div className="p-5">
            <SectionLabel>Search Performance</SectionLabel>
            <div className="grid grid-cols-2 gap-8">

              {/* GSC */}
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-3">Google Search Console</div>
                {hasGsc ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <MetricCell label="Clicks" value={r.gsc_clicks_this} delta={r.gsc_clicks_delta} pct={r.gsc_clicks_pct} />
                      <MetricCell label="Impressions" value={r.gsc_impressions_this} delta={r.gsc_impressions_delta} />
                      <MetricCell label="Avg Pos" delta={r.gsc_avg_position_delta} reverseColor sub={r.gsc_avg_position_this != null ? fmtPos(r.gsc_avg_position_this) : null} />
                      <MetricCell label="CTR" value={undefined} delta={undefined} sub={fmtPct(r.gsc_ctr_this)} />
                    </div>
                    {hasTrend && (
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1.5">3-month clicks trend</div>
                        <TrendBar trend={r.gsc_3month_trend as TrendEntry[]} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not connected</p>
                )}
              </div>

              {/* GA4 */}
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-3">Google Analytics</div>
                {hasGa4 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCell label="Sessions" value={r.ga4_sessions_this} delta={r.ga4_sessions_delta} />
                    <MetricCell label="Users" value={r.ga4_users_this} delta={r.ga4_users_delta} />
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
          <Divider />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <SectionLabel>AI Referral Traffic</SectionLabel>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 border border-violet-100 text-violet-600 font-semibold -mt-3">AI</span>
            </div>
            {(r.ga4_ai_sessions_this ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">
                No AI referral traffic detected this month. As your content builds topical authority, sessions from ChatGPT, Perplexity, Claude, and Gemini will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-6">
                  <div>
                    <span className="text-2xl font-bold tabular-nums text-violet-700">{fmtNum(r.ga4_ai_sessions_this)}</span>
                    <span className="text-sm text-slate-500 ml-1.5">sessions from AI platforms</span>
                  </div>
                  {r.ga4_ai_sessions_delta != null && (
                    <div className={`text-sm font-medium ${fmtDelta(r.ga4_ai_sessions_delta).color}`}>
                      {fmtDelta(r.ga4_ai_sessions_delta).display} vs prior month
                    </div>
                  )}
                </div>
                {r.ga4_ai_by_source && (r.ga4_ai_by_source as AiSourceEntry[]).length > 0 && (
                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                          <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">This month</th>
                          <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">vs prior</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(r.ga4_ai_by_source as AiSourceEntry[]).map((s) => {
                          const delta = s.sessions_this - (s.sessions_prior ?? 0);
                          const d = fmtDelta(delta);
                          const isNew = s.sessions_prior === 0 && s.sessions_this > 0;
                          return (
                            <tr key={s.source}>
                              <td className="px-3 py-2 text-slate-700 font-medium">{s.source}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(s.sessions_this)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {isNew
                                  ? <span className="text-violet-600 font-medium text-xs">new</span>
                                  : <span className={`${d.color} font-medium`}>{d.display}</span>}
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

      {/* ── Ranking Movement ── */}
      {(hasRankingGains || hasRankingLosses || hasTopPages || hasTopLoss) && (
        <>
          <Divider />
          <div className="p-5">
            <SectionLabel>Ranking Movement</SectionLabel>
            <div className="grid grid-cols-2 gap-6">

              {/* Gains + losses */}
              <div className="space-y-4">
                {hasRankingGains && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-2">Moved up</div>
                    <div className="space-y-1.5">
                      {(r.top_ranking_gains as RankingEntry[]).slice(0, 5).map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-emerald-500 font-bold w-5">↑{Math.round(g.change)}</span>
                          <span className="text-slate-600 truncate flex-1">{g.keyword}</span>
                          <span className="text-slate-400 text-xs whitespace-nowrap">{fmtPos(g.current_position)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasRankingLosses && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-2">Needs attention</div>
                    <div className="space-y-1.5">
                      {(r.top_ranking_losses as RankingEntry[]).slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-red-400 font-bold w-5">↓{Math.round(Math.abs(g.change))}</span>
                          <span className="text-slate-600 truncate flex-1">{g.keyword}</span>
                          <span className="text-slate-400 text-xs whitespace-nowrap">{fmtPos(g.current_position)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top pages */}
              <div className="space-y-4">
                {hasTopPages && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-2">Pages with most growth</div>
                    <div className="space-y-1.5">
                      {(r.top_pages_growth as PageEntry[]).slice(0, 5).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-emerald-500 font-semibold w-8 text-xs">+{p.delta}</span>
                          <span className="text-slate-600 truncate flex-1 text-xs">{p.page}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasTopLoss && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-2">Pages losing traffic</div>
                    <div className="space-y-1.5">
                      {(r.top_pages_loss as PageEntry[]).slice(0, 3).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-red-400 font-semibold w-8 text-xs">{p.delta}</span>
                          <span className="text-slate-600 truncate flex-1 text-xs">{p.page}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Content ── */}
      {hasContent && (
        <>
          <Divider />
          <div className="p-5">
            <SectionLabel>Content</SectionLabel>
            <div className="grid grid-cols-2 gap-6">
              {(r.articles_published?.length ?? 0) > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-2">Published this month</div>
                  <div className="space-y-2">
                    {r.articles_published!.map((a, i) => (
                      <div key={i} className="text-sm">
                        <div className="text-slate-700 font-medium leading-tight">{a.title}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{a.keyword}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(r.articles_now_ranking?.length ?? 0) > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-2">Started ranking</div>
                  <div className="space-y-2">
                    {r.articles_now_ranking!.map((a, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-sm">
                        <div className="text-slate-600 leading-tight flex-1">{a.title}</div>
                        <span className="text-amber-600 font-semibold text-xs whitespace-nowrap">{fmtPos(a.position)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(r.content_in_queue?.length ?? 0) > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-400 mb-2">In the queue</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.content_in_queue!.map((q, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
                      {q.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Technical + On-Page ── */}
      {hasTechnical && (
        <>
          <Divider />
          <div className="p-5">
            <SectionLabel>Technical &amp; On-Page</SectionLabel>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-2xl font-bold text-slate-900">{r.pages_optimized!.length}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Pages optimized</div>
              </div>
              {r.internal_links_added != null && (
                <div>
                  <div className="text-2xl font-bold text-slate-900">{r.internal_links_added}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Internal links added</div>
                </div>
              )}
              {(r.schema_types_added?.length ?? 0) > 0 && (
                <div>
                  <div className="text-2xl font-bold text-slate-900">{r.schema_types_added!.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Schema types added</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {r.pages_optimized!.slice(0, 5).map((p, i) => (
                <div key={i} className="text-xs rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                  <div className="text-slate-500 font-medium mb-1">{p.page}</div>
                  {p.before_title && p.after_title && (
                    <div className="space-y-0.5">
                      <div className="text-slate-400 line-through">{p.before_title}</div>
                      <div className="text-slate-700">{p.after_title}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── AI / GEO ── */}
      {hasAiGeo && (
        <>
          <Divider />
          <div className="p-5">
            <SectionLabel>AI &amp; GEO Visibility</SectionLabel>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {r.entity_coverage_score != null && (
                <div>
                  <div className="text-2xl font-bold text-violet-700">{r.entity_coverage_score}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Entity score
                    {r.entity_coverage_prior != null && (
                      <span className={`ml-1 font-medium ${r.entity_coverage_score >= r.entity_coverage_prior ? "text-emerald-600" : "text-red-500"}`}>
                        ({r.entity_coverage_score >= r.entity_coverage_prior ? "+" : ""}{r.entity_coverage_score - r.entity_coverage_prior})
                      </span>
                    )}
                  </div>
                </div>
              )}
              {r.faq_schema_coverage_pct != null && (
                <div>
                  <div className="text-2xl font-bold text-slate-900">{r.faq_schema_coverage_pct}%</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">FAQ schema coverage</div>
                </div>
              )}
              {(r.ai_mentions?.length ?? 0) > 0 && (
                <div>
                  <div className="text-2xl font-bold text-slate-900">{r.ai_mentions!.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">AI citations found</div>
                </div>
              )}
            </div>
            {(r.ai_mentions?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {r.ai_mentions!.map((m, i) => (
                  <div key={i} className="text-sm flex items-start gap-2">
                    <span className="text-violet-500 font-semibold flex-shrink-0">{m.platform}</span>
                    <span className="text-slate-500">{m.context}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Next Month ── */}
      {priorities.length > 0 && (
        <>
          <Divider />
          <div className="p-5">
            <SectionLabel>Next Month&rsquo;s Focus</SectionLabel>
            <ol className="space-y-2">
              {priorities.map((p, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
                  <span className="text-indigo-500 font-bold flex-shrink-0 mt-0.5 w-4">{i + 1}.</span>
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
    "form_submitted", "onboarding_setup", "month1_audit",
    "awaiting_approval", "month1_implementing",
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
