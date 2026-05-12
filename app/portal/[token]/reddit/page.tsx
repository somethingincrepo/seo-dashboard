import { getClientByToken } from "@/lib/clients";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { ThreadCard } from "@/components/reddit/ThreadCard";
import type { RedditOpportunity } from "@/lib/reddit";

export const revalidate = 0;

type Section = "opportunities" | "mentions" | "archive";

export default async function PortalRedditPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ section?: string; page?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const client = await getClientByToken(token);
  if (!client) return null;

  const section: Section =
    sp.section === "mentions" ? "mentions"
    : sp.section === "archive" ? "archive"
    : "opportunities";
  const page = Number(sp.page ?? 1);
  const offset = (page - 1) * 20;

  const base = `/portal/${token}/reddit`;
  function sectionUrl(s: string, overrides: Record<string, string> = {}) {
    const p = new URLSearchParams({ section: s, ...overrides });
    return `${base}?${p.toString()}`;
  }

  const portalApiPath = `/api/portal/reddit-opportunities?token=${encodeURIComponent(token)}`;

  const { items, total } = await listOpportunitiesForClient(client.id, {
    opportunity_type: section === "mentions" ? "mention" : section === "archive" ? undefined : "keyword",
    status: section === "archive" ? "dismissed" : "new",
    limit: 20,
    offset,
  });

  const [{ total: oppTotal }, { total: mentionTotal }] = await Promise.all([
    listOpportunitiesForClient(client.id, { opportunity_type: "keyword", status: "new", limit: 1 }),
    listOpportunitiesForClient(client.id, { opportunity_type: "mention", status: "new", limit: 1 }),
  ]);

  const NAV: Array<{ key: Section; label: string; count: number }> = [
    { key: "opportunities", label: "New Opportunities", count: oppTotal },
    { key: "mentions", label: "Mentions", count: mentionTotal },
    { key: "archive", label: "Archive", count: 0 },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900">Reddit</h1>
        <p className="text-slate-500 text-sm mt-1">
          {total} posts found
        </p>
      </div>

      {/* Sub-nav */}
      <div className="flex items-center gap-1 border-b border-slate-100 pb-3">
        {NAV.map(({ key, label, count }) => (
          <a
            key={key}
            href={sectionUrl(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              section === key
                ? "bg-slate-900 text-white font-medium"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                section === key ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"
              }`}>
                {count}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Thread list */}
      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <div className="text-3xl mb-3">▲</div>
          <div className="text-slate-600 font-medium mb-1">
            {section === "archive" ? "No archived threads" : "No threads found yet"}
          </div>
          <div className="text-slate-400 text-sm">
            {section === "archive"
              ? "Threads you dismiss will appear here."
              : "We scan Reddit daily for relevant threads. Check back soon."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((o: RedditOpportunity) => (
            <ThreadCard
              key={o.id}
              opportunity={o}
              clientId={client.id}
              apiPath={portalApiPath}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <a
            href={page > 1 ? sectionUrl(section, { page: String(page - 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              page <= 1 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            ← Previous
          </a>
          <span className="text-xs text-slate-400">Page {page} of {Math.ceil(total / 20)}</span>
          <a
            href={items.length === 20 ? sectionUrl(section, { page: String(page + 1) }) : "#"}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              items.length < 20 ? "text-slate-300 border-slate-100 pointer-events-none" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Next →
          </a>
        </div>
      )}
    </div>
  );
}
