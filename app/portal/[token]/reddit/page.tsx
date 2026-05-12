import { getClientByToken } from "@/lib/clients";
import { getEngainMentions, getEngainMentionStats, getEngainBrands } from "@/lib/engain";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import { OpportunityStatusButtons } from "@/components/reddit/OpportunityStatusButtons";
import type { MentionItem, MentionStats } from "@/lib/engain";
import type { RedditOpportunity } from "@/lib/reddit";

export const revalidate = 0;

const SENTIMENT_COLORS = {
  positive: { dot: "bg-emerald-400", text: "text-emerald-600", label: "Positive" },
  negative: { dot: "bg-red-400", text: "text-red-500", label: "Negative" },
  neutral: { dot: "bg-slate-300", text: "text-slate-500", label: "Neutral" },
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
  searchParams: Promise<{
    sentiment?: string;
    page?: string;
    tab?: string;
    kw?: string;
    ostatus?: string;
    opage?: string;
  }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const client = await getClientByToken(token);
  if (!client) return null;

  const projectId = client.fields.engain_project_id;
  const pkg = client.fields.package as PackageTier | undefined;
  const budget = pkg ? PACKAGES[pkg].reddit_comments : null;
  const tab = sp.tab === "opportunities" ? "opportunities" : "mentions";

  const base = `/portal/${token}/reddit`;
  function tabUrl(t: string) { return `${base}?tab=${t}`; }

  // Not configured — show plan info state
  if (!projectId && tab === "mentions") {
    return (
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900">Reddit</h1>
          <p className="text-slate-500 text-sm mt-1">
            Mentions and engagement opportunities for {client.fields.company_name}
          </p>
        </div>

        {budget !== null && pkg && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-slate-800 mb-1">Reddit monitoring is included in your plan</div>
                <div className="text-sm text-slate-500 leading-relaxed">
                  Your {PACKAGE_LABELS[pkg]} plan includes <span className="font-semibold text-slate-700">{budget} Reddit comments per month</span>. We&apos;re setting up brand monitoring — check back soon.
                </div>
              </div>
              <div className="shrink-0 text-center bg-orange-50 rounded-xl px-5 py-3">
                <div className="text-3xl font-bold text-orange-500">{budget}</div>
                <div className="text-[10px] text-orange-400 mt-0.5 tracking-wide">comments/mo</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <div className="text-3xl mb-3">▲</div>
          <div className="text-slate-600 font-medium mb-1">Monitoring being set up</div>
          <div className="text-slate-400 text-sm">Your Reddit tracking is being configured. Check back soon.</div>
        </div>
      </div>
    );
  }

  // ── Mentions tab ──────────────────────────────────────────────────────────────

  if (tab === "mentions") {
    const currentPage = Number(sp.page ?? 1);
    const sentiment = sp.sentiment ?? "";

    function filterUrl(overrides: Record<string, string>) {
      const next = new URLSearchParams();
      next.set("tab", "mentions");
      if (sentiment) next.set("sentiment", sentiment);
      if (currentPage > 1) next.set("page", String(currentPage));
      for (const [k, v] of Object.entries(overrides)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return `${base}?${next.toString()}`;
    }

    const [mentionsResult, statsResult] = await Promise.allSettled([
      getEngainMentions(projectId!, { limit: 20, page: currentPage, sentiment: sentiment || undefined }),
      getEngainMentionStats(projectId!),
    ]);

    const mentions = mentionsResult.status === "fulfilled" ? mentionsResult.value : null;
    const stats: MentionStats | null = statsResult.status === "fulfilled" ? statsResult.value : null;

    return (
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900">Reddit</h1>
          <p className="text-slate-500 text-sm mt-1">
            Mentions and engagement opportunities for {client.fields.company_name}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          <a
            href={tabUrl("mentions")}
            className="text-sm px-4 py-1.5 rounded-full border bg-slate-900 text-white border-slate-900"
          >
            Mentions
          </a>
          <a
            href={tabUrl("opportunities")}
            className="text-sm px-4 py-1.5 rounded-full border text-slate-600 border-slate-200 hover:border-slate-400 transition-all"
          >
            Opportunities
          </a>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Mentions", value: stats.total, color: "text-slate-900" },
              { label: "Positive", value: stats.positive, color: "text-emerald-600" },
              { label: "Neutral", value: stats.neutral, color: "text-slate-400" },
              { label: "Negative", value: stats.negative, color: "text-red-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

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
            {budget !== null && pkg && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">Monthly Reddit Comments</div>
                  <div className="text-xs text-slate-400 mt-0.5">Included in your {PACKAGE_LABELS[pkg]} plan</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-500">{budget}</div>
                  <div className="text-[10px] text-slate-400">per month</div>
                </div>
              </div>
            )}
          </div>
        )}

        {stats?.top_subreddits && stats.top_subreddits.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className="text-sm font-medium text-slate-700 mb-3">Most Active Subreddits</div>
            <div className="space-y-2">
              {stats.top_subreddits.slice(0, 6).map((s) => {
                const pct = Math.round((s.count / Math.max(stats.total, 1)) * 100);
                return (
                  <div key={s.subreddit} className="flex items-center gap-3">
                    <div className="text-xs text-orange-500 font-medium w-32 truncate shrink-0">r/{s.subreddit}</div>
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

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              {sentiment ? `${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} mentions` : "All mentions"}
            </div>
            {mentions && <span className="text-xs text-slate-400">{mentions.total} total</span>}
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
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-[11px] font-semibold text-orange-500">r/{m.subreddit}</span>
                          <span className={`flex items-center gap-1 text-[10px] font-medium ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          {m.type === "comment" && (
                            <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">comment</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{m.title}</div>
                        {m.content && (
                          <div className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{m.content}</div>
                        )}
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

        {mentions && mentions.total > 20 && (
          <div className="flex items-center justify-between pt-2">
            <a
              href={currentPage > 1 ? filterUrl({ page: String(currentPage - 1) }) : "#"}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                currentPage <= 1 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              ← Previous
            </a>
            <span className="text-xs text-slate-400">Page {currentPage} of {Math.ceil(mentions.total / 20)}</span>
            <a
              href={mentions.items.length === 20 ? filterUrl({ page: String(currentPage + 1) }) : "#"}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                mentions.items.length < 20 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Next →
            </a>
          </div>
        )}
      </div>
    );
  }

  // ── Opportunities tab ──────────────────────────────────────────────────────────

  const ostatus = sp.ostatus ?? "";
  const kw = sp.kw ?? "";
  const opage = Number(sp.opage ?? 1);
  const opOffset = (opage - 1) * 20;

  const { items: opportunities, total: opTotal } = await listOpportunitiesForClient(client.id, {
    status: ostatus || undefined,
    keyword: kw || undefined,
    limit: 20,
    offset: opOffset,
  });

  // Fetch distinct keywords for filter pills
  const { items: allKwItems } = await listOpportunitiesForClient(client.id, { limit: 200 });
  const distinctKeywords = [...new Set(allKwItems.map((o) => o.keyword))].sort();
  const newCount = allKwItems.filter((o) => o.status === "new").length;

  function opFilterUrl(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    next.set("tab", "opportunities");
    if (ostatus) next.set("ostatus", ostatus);
    if (kw) next.set("kw", kw);
    if (opage > 1) next.set("opage", String(opage));
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `${base}?${next.toString()}`;
  }

  // Portal API path includes token as query param
  const portalApiPath = `/api/portal/reddit-opportunities?token=${encodeURIComponent(token)}`;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900">Reddit</h1>
        <p className="text-slate-500 text-sm mt-1">
          Mentions and engagement opportunities for {client.fields.company_name}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        <a
          href={tabUrl("mentions")}
          className="text-sm px-4 py-1.5 rounded-full border text-slate-600 border-slate-200 hover:border-slate-400 transition-all"
        >
          Mentions
        </a>
        <a
          href={tabUrl("opportunities")}
          className="text-sm px-4 py-1.5 rounded-full border bg-slate-900 text-white border-slate-900"
        >
          Opportunities {newCount > 0 && <span className="ml-1 text-orange-300 font-bold">{newCount}</span>}
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "New", value: allKwItems.filter(o => o.status === "new").length, color: "text-indigo-600" },
          { label: "Replied", value: allKwItems.filter(o => o.status === "replied").length, color: "text-emerald-600" },
          { label: "Rank on Google", value: allKwItems.filter(o => o.ranks_on_google).length, color: "text-orange-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-[0_1px_2px_0_rgba(16,24,40,0.05)]">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-slate-500 font-medium self-center">Status:</span>
        {([
          { value: "", label: "All" },
          { value: "new", label: "New" },
          { value: "viewed", label: "Viewed" },
          { value: "replied", label: "Replied" },
        ] as const).map(({ value, label }) => (
          <a
            key={value}
            href={opFilterUrl({ ostatus: value, opage: "1" })}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              ostatus === value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {label}
          </a>
        ))}

        {distinctKeywords.length > 1 && (
          <>
            <span className="text-slate-200 mx-1 self-center">|</span>
            <span className="text-xs text-slate-500 font-medium self-center">Keyword:</span>
            <a
              href={opFilterUrl({ kw: "", opage: "1" })}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                !kw ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              All
            </a>
            {distinctKeywords.map((k) => (
              <a
                key={k}
                href={opFilterUrl({ kw: k, opage: "1" })}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  kw === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {k}
              </a>
            ))}
          </>
        )}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">Thread Opportunities</div>
          {opTotal > 0 && <span className="text-xs text-slate-400">{opTotal} total</span>}
        </div>

        {opportunities.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
            <div className="text-3xl mb-3">▲</div>
            <div className="text-slate-600 font-medium mb-1">No opportunities yet</div>
            <div className="text-slate-400 text-sm">
              We scan Reddit daily for threads where you could engage. Check back soon.
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-[0_1px_2px_0_rgba(16,24,40,0.05)] overflow-hidden">
            {opportunities.map((o: RedditOpportunity) => (
              <div key={o.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[11px] font-semibold text-orange-500">r/{o.subreddit}</span>
                      {o.ranks_on_google && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-emerald-100">
                          ★ Ranks on Google
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{o.title}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                      <span>▲ {o.upvotes}</span>
                      <span>💬 {o.num_comments}</span>
                      <span>{timeAgo(o.created_utc)}</span>
                    </div>
                    <div className="mt-2">
                      <OpportunityStatusButtons
                        id={o.id}
                        clientId={client.id}
                        currentStatus={o.status}
                        apiPath={portalApiPath}
                      />
                    </div>
                  </div>
                  <a
                    href={o.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 mt-1 text-xs text-slate-400 hover:text-slate-700 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1 transition-all"
                  >
                    View ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {opTotal > 20 && (
        <div className="flex items-center justify-between pt-2">
          <a
            href={opage > 1 ? opFilterUrl({ opage: String(opage - 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              opage <= 1 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            ← Previous
          </a>
          <span className="text-xs text-slate-400">Page {opage} of {Math.ceil(opTotal / 20)}</span>
          <a
            href={opportunities.length === 20 ? opFilterUrl({ opage: String(opage + 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              opportunities.length < 20 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Next →
          </a>
        </div>
      )}
    </div>
  );
}
