import { getClientByToken } from "@/lib/clients";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { RedditDashboard } from "@/components/reddit/RedditDashboard";
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

      <RedditDashboard
        initialItems={items}
        total={total}
        clientId={client.id}
        apiPath={portalApiPath}
        emptyMessage={
          section === "archive"
            ? "No archived threads yet."
            : "We scan Reddit daily for relevant threads. Check back soon."
        }
      />
    </div>
  );
}
