import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getEngainMentions, getEngainMentionStats, getEngainBrands } from "@/lib/engain";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import type { MentionItem, MentionStats } from "@/lib/engain";

export const revalidate = 0;

const SENTIMENT_COLORS = {
  positive: { dot: "bg-emerald-400", text: "text-emerald-600", label: "Positive" },
  negative: { dot: "bg-red-400", text: "text-red-500", label: "Negative" },
  neutral:  { dot: "bg-slate-300", text: "text-slate-500", label: "Neutral" },
};

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

function SentimentBar({ stats }: { stats: MentionStats }) {
  const total = Math.max(stats.total, 1);
  const posW = Math.round((stats.positive / total) * 100);
  const neuW = Math.round((stats.neutral / total) * 100);
  const negW = 100 - posW - neuW;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 gap-0.5">
      {posW > 0 && <div className="bg-emerald-400 rounded-full" style={{ width: `${posW}%` }} />}
      {neuW > 0 && <div className="bg-slate-200 rounded-full" style={{ width: `${neuW}%` }} />}
      {negW > 0 && <div className="bg-red-400 rounded-full" style={{ width: `${negW}%` }} />}
    </div>
  );
}

export default async function PortalRedditPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sentiment?: string; page?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const client = await getClientByToken(token);
  if (!client) notFound();

  const projectId = client.fields.engain_project_id;
  const pkg = client.fields.package as PackageTier | undefined;
  const budget = pkg ? PACKAGES[pkg].reddit_comments : null;

  if (!projectId) notFound();

  const currentPage = Number(sp.page ?? 1);
  const sentiment = sp.sentiment ?? "";

  const base = `/portal/${token}/reddit`;

  function filterUrl(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    if (sentiment) next.set("sentiment", sentiment);
    if (currentPage > 1) next.set("page", String(currentPage));
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const str = next.toString();
    return str ? `${base}?${str}` : base;
  }

  const [mentionsResult, statsResult, brandsResult] = await Promise.allSettled([
    getEngainMentions(projectId, {
      limit: 20,
      page: currentPage,
      sentiment: sentiment || undefined,
    }),
    getEngainMentionStats(projectId),
    getEngainBrands(projectId),
  ]);

  const mentions = mentionsResult.status === "fulfilled" ? mentionsResult.value : null;
  const stats: MentionStats | null = statsResult.status === "fulfilled" ? statsResult.value : null;
  const brands = brandsResult.status === "fulfilled" ? brandsResult.value : [];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900">Reddit Mentions</h1>
        <p className="text-slate-500 text-sm mt-1">
          What people are saying about {client.fields.company_name} on Reddit
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total Mentions</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className="text-2xl font-bold text-emerald-600">{stats.positive}</div>
            <div className="text-xs text-slate-500 mt-0.5">Positive</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className="text-2xl font-bold text-slate-400">{stats.neutral}</div>
            <div className="text-xs text-slate-500 mt-0.5">Neutral</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className="text-2xl font-bold text-red-500">{stats.negative}</div>
            <div className="text-xs text-slate-500 mt-0.5">Negative</div>
          </div>
        </div>
      )}

      {/* Sentiment + budget */}
      {stats && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Overall Sentiment</span>
            {stats.avg_score != null && (
              <span className="text-xs text-slate-400">avg score {stats.avg_score.toFixed(1)}</span>
            )}
          </div>
          <SentimentBar stats={stats} />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-emerald-500 font-medium">
              {Math.round((stats.positive / Math.max(stats.total, 1)) * 100)}% positive
            </span>
            <span>{Math.round((stats.neutral / Math.max(stats.total, 1)) * 100)}% neutral</span>
            <span className="text-red-400 font-medium">
              {Math.round((stats.negative / Math.max(stats.total, 1)) * 100)}% negative
            </span>
          </div>

          {/* Monthly comment budget */}
          {budget !== null && pkg && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700">Monthly Reddit Comments</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Included in your {PACKAGE_LABELS[pkg]} plan
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-500">{budget}</div>
                <div className="text-[10px] text-slate-400">per month</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top subreddits */}
      {stats?.top_subreddits && stats.top_subreddits.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
          <div className="text-sm font-medium text-slate-700 mb-3">Most Active Subreddits</div>
          <div className="space-y-2">
            {stats.top_subreddits.slice(0, 6).map((s) => {
              const pct = Math.round((s.count / Math.max(stats.total, 1)) * 100);
              return (
                <div key={s.subreddit} className="flex items-center gap-3">
                  <div className="text-xs text-orange-500 font-medium w-32 truncate shrink-0">
                    r/{s.subreddit}
                  </div>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-200 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-slate-400 w-8 text-right shrink-0">{s.count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentiment filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Filter:</span>
        {([
          { value: "", label: "All" },
          { value: "positive", label: "Positive" },
          { value: "neutral", label: "Neutral" },
          { value: "negative", label: "Negative" },
        ] as const).map(({ value, label }) => (
          <a
            key={value}
            href={filterUrl({ sentiment: value, page: "1" })}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              sentiment === value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Mentions feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">
            {sentiment ? `${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} mentions` : "All mentions"}
          </div>
          {mentions && (
            <span className="text-xs text-slate-400">{mentions.total} total</span>
          )}
        </div>

        {!mentions ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            Could not load mentions
          </div>
        ) : mentions.items.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            No mentions found
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] overflow-hidden">
            {mentions.items.map((m: MentionItem) => {
              const s = SENTIMENT_COLORS[m.sentiment] ?? SENTIMENT_COLORS.neutral;
              return (
                <div key={m.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Subreddit + sentiment + type */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[11px] font-semibold text-orange-500">r/{m.subreddit}</span>
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        {m.type === "comment" && (
                          <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                            comment
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">
                        {m.title}
                      </div>

                      {/* Content snippet */}
                      {m.content && (
                        <div className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {m.content}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span>▲ {m.upvotes ?? m.score ?? 0}</span>
                        {(m.comments ?? 0) > 0 && <span>💬 {m.comments}</span>}
                        <span>u/{m.author}</span>
                        <span>{timeAgo(m.created_at)}</span>
                      </div>
                    </div>

                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 mt-1 text-xs text-slate-400 hover:text-slate-700 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1 transition-all"
                      >
                        View ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {mentions && mentions.total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <a
            href={currentPage > 1 ? filterUrl({ page: String(currentPage - 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              currentPage <= 1
                ? "text-slate-300 border-slate-100 pointer-events-none"
                : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            ← Previous
          </a>
          <span className="text-xs text-slate-400">
            Page {currentPage} of {Math.ceil(mentions.total / 20)}
          </span>
          <a
            href={mentions.items.length === 20 ? filterUrl({ page: String(currentPage + 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              mentions.items.length < 20
                ? "text-slate-300 border-slate-100 pointer-events-none"
                : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Next →
          </a>
        </div>
      )}
    </div>
  );
}
