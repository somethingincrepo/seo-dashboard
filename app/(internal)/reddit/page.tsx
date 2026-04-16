import Link from "next/link";
import { getClients } from "@/lib/clients";
import { getEngainMentionStats } from "@/lib/engain";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import type { MentionStats } from "@/lib/engain";

export const dynamic = "force-dynamic";

type ClientRow = {
  recordId: string;
  name: string;
  siteUrl: string;
  projectId: string;
  package: PackageTier | null;
  stats: MentionStats | null;
  error?: string;
};

function SentimentBar({ stats }: { stats: MentionStats }) {
  const total = Math.max(stats.total, 1);
  const posW = Math.round((stats.positive / total) * 100);
  const neuW = Math.round((stats.neutral / total) * 100);
  const negW = 100 - posW - neuW;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 gap-px">
      {posW > 0 && <div className="bg-emerald-400" style={{ width: `${posW}%` }} />}
      {neuW > 0 && <div className="bg-slate-300" style={{ width: `${neuW}%` }} />}
      {negW > 0 && <div className="bg-red-400" style={{ width: `${negW}%` }} />}
    </div>
  );
}

export default async function RedditPage() {
  const clients = await getClients();
  const linked = clients.filter((c) => c.fields.engain_project_id);
  const unlinked = clients.filter((c) => !c.fields.engain_project_id);

  const rows: ClientRow[] = await Promise.all(
    linked.map(async (c) => {
      const projectId = c.fields.engain_project_id;
      const pkg = (c.fields.package as PackageTier) || null;
      try {
        const stats = await getEngainMentionStats(projectId);
        return { recordId: c.id, name: c.fields.company_name, siteUrl: c.fields.site_url, projectId, package: pkg, stats };
      } catch (err) {
        return {
          recordId: c.id,
          name: c.fields.company_name,
          siteUrl: c.fields.site_url,
          projectId,
          package: pkg,
          stats: null,
          error: err instanceof Error ? err.message : "Failed to load",
        };
      }
    })
  );

  const totalMentions = rows.reduce((s, r) => s + (r.stats?.total ?? 0), 0);
  const totalPositive = rows.reduce((s, r) => s + (r.stats?.positive ?? 0), 0);
  const totalNegative = rows.reduce((s, r) => s + (r.stats?.negative ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Reddit Monitoring</h1>
        <p className="text-slate-500 text-sm mt-1">
          Brand mentions across Reddit ·{" "}
          <span className="text-slate-400">{linked.length} brand{linked.length !== 1 ? "s" : ""} monitored</span>
        </p>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{linked.length}</div>
          <div className="text-slate-500 text-xs mt-1">Monitored Brands</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{totalMentions}</div>
          <div className="text-slate-500 text-xs mt-1">Total Mentions</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{totalPositive}</div>
          <div className="text-slate-500 text-xs mt-1">Positive</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{totalNegative}</div>
          <div className="text-slate-500 text-xs mt-1">Negative</div>
        </GlassCard>
      </div>

      {/* Monitored brands grid */}
      {rows.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Monitored Brands</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const budget = row.package ? PACKAGES[row.package].reddit_comments : null;
              return (
                <Link key={row.recordId} href={`/reddit/${row.recordId}`}>
                  <GlassCard hover className="p-5 space-y-4">
                    {/* Name + package */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-900 truncate">{row.name}</div>
                        {row.siteUrl && (
                          <div className="text-xs text-slate-400 truncate mt-0.5">{row.siteUrl}</div>
                        )}
                      </div>
                      {row.package && (
                        <StatusBadge value={row.package} variant="plan_status" className="shrink-0" />
                      )}
                    </div>

                    {row.error ? (
                      <div className="text-xs text-red-400 bg-red-50 rounded-lg px-3 py-2">{row.error}</div>
                    ) : row.stats ? (
                      <>
                        {/* Sentiment bar */}
                        <SentimentBar stats={row.stats} />

                        {/* Mention counts */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-base font-bold text-emerald-600">{row.stats.positive}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Positive</div>
                          </div>
                          <div>
                            <div className="text-base font-bold text-slate-400">{row.stats.neutral}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Neutral</div>
                          </div>
                          <div>
                            <div className="text-base font-bold text-red-500">{row.stats.negative}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Negative</div>
                          </div>
                        </div>

                        {/* Monthly comment budget */}
                        {budget !== null && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500">Monthly comment budget</span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {budget}/mo
                            </span>
                          </div>
                        )}

                        {/* Top subreddits */}
                        {row.stats.top_subreddits?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {row.stats.top_subreddits.slice(0, 3).map((s) => (
                              <span key={s.subreddit} className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                                r/{s.subreddit}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <GlassCard className="p-12 text-center">
          <div className="text-4xl mb-4">▲</div>
          <div className="text-slate-700 font-medium mb-1">No brands configured yet</div>
          <div className="text-slate-400 text-sm">
            Open a client record and connect a Reddit monitoring project to get started.
          </div>
        </GlassCard>
      )}

      {/* Unlinked clients */}
      {unlinked.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
            Not Configured ({unlinked.length})
          </h2>
          <GlassCard>
            <div className="divide-y divide-slate-100">
              {unlinked.map((c) => {
                const pkg = c.fields.package as PackageTier | undefined;
                const budget = pkg ? PACKAGES[pkg].reddit_comments : null;
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-700 truncate">{c.fields.company_name}</div>
                        <div className="text-xs text-slate-400 truncate">{c.fields.site_url}</div>
                      </div>
                      {budget !== null && (
                        <span className="text-[10px] text-slate-400 shrink-0">{budget} comments/mo in plan</span>
                      )}
                    </div>
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors shrink-0"
                    >
                      Configure →
                    </Link>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  );
}
