import { getClientByToken } from "@/lib/clients";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { RedditDashboard } from "@/components/reddit/RedditDashboard";

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
  function sectionUrl(s: string) {
    return `${base}?section=${s}`;
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
    { key: "opportunities", label: "Opportunities", count: oppTotal },
    { key: "mentions", label: "Mentions", count: mentionTotal },
    { key: "archive", label: "Archive", count: 0 },
  ];

  return (
    // Break out of the p-10 portal padding to go full height
    <div className="-m-10 h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="px-10 pt-7 pb-4 border-b border-slate-100 shrink-0">
        <h1 className="text-[20px] font-semibold text-slate-900 mb-4">Reddit</h1>
        <div className="flex items-center gap-1">
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
      </div>

      {/* Dashboard fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col px-10 py-5">
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
    </div>
  );
}
