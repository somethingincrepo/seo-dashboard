import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/clients";
import { getEngainMentions, getEngainMentionStats, getEngainBrands } from "@/lib/engain";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import { OpportunityStatusButtons } from "@/components/reddit/OpportunityStatusButtons";
import type { MentionItem, MentionStats } from "@/lib/engain";
import type { RedditOpportunity } from "@/lib/reddit";

export const dynamic = "force-dynamic";

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "text-emerald-700 bg-emerald-50 ring-emerald-100",
  negative: "text-red-700 bg-red-50 ring-red-100",
  neutral:  "text-slate-600 bg-slate-50 ring-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  new:       "text-indigo-700 bg-indigo-50 ring-indigo-100",
  viewed:    "text-slate-600 bg-slate-50 ring-slate-200",
  replied:   "text-emerald-700 bg-emerald-50 ring-emerald-100",
  dismissed: "text-slate-400 bg-slate-50 ring-slate-100",
};

function SentimentBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset capitalize ${SENTIMENT_STYLES[value] ?? SENTIMENT_STYLES.neutral}`}>
      {value}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset capitalize ${STATUS_STYLES[value] ?? STATUS_STYLES.new}`}>
      {value}
    </span>
  );
}

function SentimentBar({ stats }: { stats: MentionStats }) {
  const total = Math.max(stats.total, 1);
  const posW = Math.round((stats.positive / total) * 100);
  const neuW = Math.round((stats.neutral / total) * 100);
  const negW = 100 - posW - neuW;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 gap-px">
      {posW > 0 && <div className="bg-emerald-400 rounded-full" style={{ width: `${posW}%` }} />}
      {neuW > 0 && <div className="bg-slate-300 rounded-full" style={{ width: `${neuW}%` }} />}
      {negW > 0 && <div className="bg-red-400 rounded-full" style={{ width: `${negW}%` }} />}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return dateStr;
  }
}

export default async function RedditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    sentiment?: string;
    brand?: string;
    page?: string;
    tab?: string;
    kw?: string;
    opage?: string;
    ostatus?: string;
  }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;

  const client = await getClient(clientId);
  if (!client) notFound();

  const projectId = client.fields.engain_project_id;
  const pkg = client.fields.package as PackageTier | undefined;
  const budget = pkg ? PACKAGES[pkg].reddit_comments : null;
  const tab = sp.tab === "opportunities" ? "opportunities" : "mentions";

  if (!projectId && tab === "mentions") {
    return (
      <div className="space-y-6">
        <Link href="/reddit" className="text-slate-500 text-sm hover:text-slate-600 transition-colors">
          ← Reddit
        </Link>
        <GlassCard className="p-12 text-center">
          <div className="text-4xl mb-4">▲</div>
          <div className="text-slate-700 font-medium mb-1">{client.fields.company_name} isn't configured yet</div>
          <div className="text-slate-400 text-sm mb-4">Connect a Reddit monitoring project to start tracking brand mentions.</div>
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            Go to client settings →
          </Link>
        </GlassCard>
      </div>
    );
  }

  function tabUrl(t: string) {
    return `?tab=${t}`;
  }

  // ── Mentions tab ────────────────────────────────────────────────────────────

  if (tab === "mentions") {
    const currentPage = Number(sp.page ?? 1);
    const sentiment = sp.sentiment ?? "";
    const brand = sp.brand ?? "";

    const [mentionsResult, statsResult, brandsResult] = await Promise.allSettled([
      getEngainMentions(projectId!, {
        limit: 25,
        page: currentPage,
        sentiment: sentiment || undefined,
        brand: brand || undefined,
      }),
      getEngainMentionStats(projectId!),
      getEngainBrands(projectId!),
    ]);

    const mentions = mentionsResult.status === "fulfilled" ? mentionsResult.value : null;
    const stats: MentionStats | null = statsResult.status === "fulfilled" ? statsResult.value : null;
    const brands = brandsResult.status === "fulfilled" ? brandsResult.value : [];

    function filterUrl(overrides: Record<string, string>) {
      const next = new URLSearchParams();
      next.set("tab", "mentions");
      if (sentiment) next.set("sentiment", sentiment);
      if (brand) next.set("brand", brand);
      if (currentPage > 1) next.set("page", String(currentPage));
      for (const [k, v] of Object.entries(overrides)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return `?${next.toString()}`;
    }

    return (
      <div className="space-y-8">
        <div>
          <Link href="/reddit" className="text-slate-500 text-sm hover:text-slate-600 transition-colors">
            ← Reddit
          </Link>
          <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{client.fields.company_name}</h1>
                {pkg && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    pkg === "starter" ? "bg-slate-100 text-slate-600"
                    : pkg === "growth" ? "bg-indigo-50 text-indigo-700"
                    : "bg-violet-50 text-violet-700"
                  }`}>
                    {PACKAGE_LABELS[pkg]}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm mt-0.5">Reddit monitoring</p>
            </div>
            <Link
              href={`/clients/${clientId}`}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-xl shrink-0"
            >
              Client settings ↗
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          <Link
            href={tabUrl("mentions")}
            className="text-sm px-4 py-1.5 rounded-full border bg-slate-900 text-white border-slate-900"
          >
            Mentions
          </Link>
          <Link
            href={tabUrl("opportunities")}
            className="text-sm px-4 py-1.5 rounded-full border text-slate-600 border-slate-200 hover:border-slate-400 transition-all"
          >
            Opportunities
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{stats?.total ?? "—"}</div>
            <div className="text-slate-500 text-xs mt-1">Total Mentions</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats?.positive ?? "—"}</div>
            <div className="text-slate-500 text-xs mt-1">Positive</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-400">{stats?.neutral ?? "—"}</div>
            <div className="text-slate-500 text-xs mt-1">Neutral</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats?.negative ?? "—"}</div>
            <div className="text-slate-500 text-xs mt-1">Negative</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{budget ?? "—"}</div>
            <div className="text-slate-500 text-xs mt-1">Comments/mo</div>
            {pkg && <div className="text-[10px] text-slate-400 mt-0.5">{PACKAGE_LABELS[pkg]} plan</div>}
          </GlassCard>
        </div>

        {stats && (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">Sentiment Overview</div>
              <div className="text-xs text-slate-400">avg score {stats.avg_score ? stats.avg_score.toFixed(1) : "—"}</div>
            </div>
            <SentimentBar stats={stats} />
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
              <span className="text-emerald-500">{Math.round((stats.positive / Math.max(stats.total, 1)) * 100)}% positive</span>
              <span>{Math.round((stats.neutral / Math.max(stats.total, 1)) * 100)}% neutral</span>
              <span className="text-red-400">{Math.round((stats.negative / Math.max(stats.total, 1)) * 100)}% negative</span>
            </div>
          </GlassCard>
        )}

        {stats?.top_subreddits && stats.top_subreddits.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Top Subreddits</h2>
            <GlassCard className="p-4">
              <div className="flex flex-wrap gap-2">
                {stats.top_subreddits.map((s) => (
                  <span key={s.subreddit} className="flex items-center gap-1.5 text-xs bg-slate-100 rounded-full px-3 py-1">
                    <span className="text-orange-500 font-medium">r/{s.subreddit}</span>
                    <span className="text-slate-400">{s.count}</span>
                  </span>
                ))}
              </div>
            </GlassCard>
          </section>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium mr-1">Sentiment:</span>
          {(["", "positive", "neutral", "negative"] as const).map((s) => (
            <Link
              key={s}
              href={filterUrl({ sentiment: s, page: "1" })}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                sentiment === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}

          {brands.length > 0 && (
            <>
              <span className="text-slate-200 mx-1">|</span>
              <span className="text-xs text-slate-500 font-medium mr-1">Brand:</span>
              <Link
                href={filterUrl({ brand: "", page: "1" })}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  !brand ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                All
              </Link>
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={filterUrl({ brand: b.name, page: "1" })}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    brand === b.name ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {b.name}
                </Link>
              ))}
            </>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Mentions</h2>
            {mentions && <span className="text-xs text-slate-400">{mentions.total} total</span>}
          </div>
          <GlassCard>
            <div className="divide-y divide-slate-100">
              {!mentions ? (
                <div className="px-5 py-10 text-center text-red-400 text-sm">Failed to load mentions</div>
              ) : mentions.items.length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-400 text-sm">No mentions found</div>
              ) : (
                mentions.items.map((m: MentionItem) => (
                  <div key={m.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-xs font-medium text-orange-500">r/{m.subreddit}</span>
                          <SentimentBadge value={m.sentiment} />
                          {m.type === "comment" && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ring-1 ring-inset ring-slate-200">comment</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{m.title}</div>
                        {m.content && (
                          <div className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{m.content}</div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span>▲ {m.upvotes ?? m.score ?? 0}</span>
                          <span>💬 {m.comments ?? 0}</span>
                          <span>u/{m.author}</span>
                          <span>{timeAgo(m.created_at)}</span>
                        </div>
                      </div>
                      {m.url && (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0 mt-1 border border-slate-200 rounded-lg px-2.5 py-1 hover:border-indigo-200"
                        >
                          View ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </section>

        {mentions && mentions.total > 25 && (
          <div className="flex items-center justify-between">
            <Link
              href={currentPage > 1 ? filterUrl({ page: String(currentPage - 1) }) : "#"}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                currentPage <= 1 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              ← Previous
            </Link>
            <span className="text-xs text-slate-400">Page {currentPage} of {Math.ceil(mentions.total / 25)}</span>
            <Link
              href={mentions.items.length === 25 ? filterUrl({ page: String(currentPage + 1) }) : "#"}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                mentions.items.length < 25 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Next →
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ── Opportunities tab ────────────────────────────────────────────────────────

  const ostatus = sp.ostatus ?? "";
  const kw = sp.kw ?? "";
  const opage = Number(sp.opage ?? 1);
  const opOffset = (opage - 1) * 25;

  const { items: opportunities, total: opTotal } = await listOpportunitiesForClient(clientId, {
    status: ostatus || undefined,
    keyword: kw || undefined,
    limit: 25,
    offset: opOffset,
  });

  // Gather distinct keywords from a broader query for filter pills
  const { items: allKwItems } = await listOpportunitiesForClient(clientId, { limit: 200 });
  const distinctKeywords = [...new Set(allKwItems.map((o) => o.keyword))].sort();

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
    return `?${next.toString()}`;
  }

  const newCount = allKwItems.filter((o) => o.status === "new").length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/reddit" className="text-slate-500 text-sm hover:text-slate-600 transition-colors">
          ← Reddit
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{client.fields.company_name}</h1>
              {pkg && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  pkg === "starter" ? "bg-slate-100 text-slate-600"
                  : pkg === "growth" ? "bg-indigo-50 text-indigo-700"
                  : "bg-violet-50 text-violet-700"
                }`}>
                  {PACKAGE_LABELS[pkg]}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-0.5">Reddit monitoring</p>
          </div>
          <Link
            href={`/clients/${clientId}`}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-xl shrink-0"
          >
            Client settings ↗
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        <Link
          href={tabUrl("mentions")}
          className="text-sm px-4 py-1.5 rounded-full border text-slate-600 border-slate-200 hover:border-slate-400 transition-all"
        >
          Mentions
        </Link>
        <Link
          href={tabUrl("opportunities")}
          className="text-sm px-4 py-1.5 rounded-full border bg-slate-900 text-white border-slate-900"
        >
          Opportunities {newCount > 0 && <span className="ml-1 text-orange-300 font-bold">{newCount}</span>}
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{allKwItems.filter(o => o.status === "new").length}</div>
          <div className="text-slate-500 text-xs mt-1">New</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{allKwItems.filter(o => o.status === "replied").length}</div>
          <div className="text-slate-500 text-xs mt-1">Replied</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{allKwItems.filter(o => o.ranks_on_google).length}</div>
          <div className="text-slate-500 text-xs mt-1">Rank on Google</div>
        </GlassCard>
      </div>

      {/* Status + keyword filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-slate-500 font-medium mr-1 self-center">Status:</span>
        {([
          { value: "", label: "All" },
          { value: "new", label: "New" },
          { value: "viewed", label: "Viewed" },
          { value: "replied", label: "Replied" },
          { value: "dismissed", label: "Dismissed" },
        ] as const).map(({ value, label }) => (
          <Link
            key={value}
            href={opFilterUrl({ ostatus: value, opage: "1" })}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              ostatus === value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {label}
          </Link>
        ))}

        {distinctKeywords.length > 0 && (
          <>
            <span className="text-slate-200 mx-1 self-center">|</span>
            <span className="text-xs text-slate-500 font-medium mr-1 self-center">Keyword:</span>
            <Link
              href={opFilterUrl({ kw: "", opage: "1" })}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                !kw ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              All
            </Link>
            {distinctKeywords.map((k) => (
              <Link
                key={k}
                href={opFilterUrl({ kw: k, opage: "1" })}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  kw === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {k}
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Opportunities feed */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Thread Opportunities</h2>
          {opTotal > 0 && <span className="text-xs text-slate-400">{opTotal} total</span>}
        </div>

        {opportunities.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <div className="text-3xl mb-3">▲</div>
            <div className="text-slate-700 font-medium mb-1">No opportunities found</div>
            <div className="text-slate-400 text-sm">
              {allKwItems.length === 0
                ? "Run the opportunity scan to populate threads from Reddit."
                : "Try a different filter."}
            </div>
          </GlassCard>
        ) : (
          <GlassCard>
            <div className="divide-y divide-slate-100">
              {opportunities.map((o: RedditOpportunity) => (
                <div key={o.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-medium text-orange-500">r/{o.subreddit}</span>
                        <StatusPill value={o.status} />
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          score: {o.relevance_score}
                        </span>
                        {o.ranks_on_google && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-emerald-100">
                            ★ Ranks on Google
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{o.title}</div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                        <span>keyword: <span className="text-slate-600 font-medium">{o.keyword}</span></span>
                        <span>▲ {o.upvotes}</span>
                        <span>💬 {o.num_comments}</span>
                        <span>{timeAgo(o.created_utc)}</span>
                      </div>
                      <div className="mt-2">
                        <OpportunityStatusButtons
                          id={o.id}
                          clientId={clientId}
                          currentStatus={o.status}
                        />
                      </div>
                    </div>
                    <a
                      href={o.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0 mt-1 border border-slate-200 rounded-lg px-2.5 py-1 hover:border-indigo-200"
                    >
                      View ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </section>

      {opTotal > 25 && (
        <div className="flex items-center justify-between">
          <Link
            href={opage > 1 ? opFilterUrl({ opage: String(opage - 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              opage <= 1 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            ← Previous
          </Link>
          <span className="text-xs text-slate-400">Page {opage} of {Math.ceil(opTotal / 25)}</span>
          <Link
            href={opportunities.length === 25 ? opFilterUrl({ opage: String(opage + 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              opportunities.length < 25 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
