import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/clients";
import { listOpportunitiesForClient } from "@/lib/reddit";
import { GlassCard } from "@/components/ui/GlassCard";
import { PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import { RedditDashboard } from "@/components/reddit/RedditDashboard";
import type { RedditOpportunity } from "@/lib/reddit";

export const dynamic = "force-dynamic";

type Section = "opportunities" | "mentions" | "archive";

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return dateStr; }
}

export default async function RedditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ section?: string; page?: string; kw?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;

  const client = await getClient(clientId);
  if (!client) notFound();

  const pkg = client.fields.package as PackageTier | undefined;
  const section: Section =
    sp.section === "mentions" ? "mentions"
    : sp.section === "archive" ? "archive"
    : "opportunities";
  const page = Number(sp.page ?? 1);
  const kw = sp.kw ?? "";
  const offset = (page - 1) * 25;

  function sectionUrl(s: string, overrides: Record<string, string> = {}) {
    const p = new URLSearchParams({ section: s, ...overrides });
    return `?${p.toString()}`;
  }

  // Fetch data for current section
  const { items, total } = await listOpportunitiesForClient(clientId, {
    opportunity_type: section === "mentions" ? "mention" : section === "archive" ? undefined : "keyword",
    status: section === "archive" ? "dismissed" : "new",
    keyword: kw || undefined,
    limit: 25,
    offset,
  });

  // Counts for badges
  const [{ total: oppTotal }, { total: mentionTotal }, { total: archiveTotal }] = await Promise.all([
    listOpportunitiesForClient(clientId, { opportunity_type: "keyword", status: "new", limit: 1 }),
    listOpportunitiesForClient(clientId, { opportunity_type: "mention", status: "new", limit: 1 }),
    listOpportunitiesForClient(clientId, { status: "dismissed", limit: 1 }),
  ]);

  const NAV: Array<{ key: Section; label: string; count: number }> = [
    { key: "opportunities", label: "New Opportunities", count: oppTotal },
    { key: "mentions", label: "Mentions", count: mentionTotal },
    { key: "archive", label: "Archive", count: archiveTotal },
  ];

  return (
    <div className="flex gap-6 -m-8 h-screen overflow-hidden">
      {/* ── Left sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 overflow-y-auto border-r border-slate-100 bg-white">
        <div className="p-6 space-y-1">
          <Link href="/reddit" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-4 transition-colors">
            ← All clients
          </Link>
          <div className="text-xs font-bold tracking-widest text-slate-400 uppercase px-2 mb-2">
            {client.fields.company_name}
          </div>

          {NAV.map(({ key, label, count }) => (
            <Link
              key={key}
              href={sectionUrl(key)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                section === key
                  ? "bg-slate-900 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  section === key ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"
                }`}>
                  {count}
                </span>
              )}
            </Link>
          ))}

          <div className="border-t border-slate-100 pt-3 mt-3">
            <Link
              href={`/clients/${clientId}`}
              className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Client settings ↗
            </Link>
          </div>

          {pkg && (
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 mb-0.5">Package</div>
              <div className="text-xs font-semibold text-slate-700">{PACKAGE_LABELS[pkg]}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6">
        <RedditDashboard
          initialItems={items}
          total={total}
          clientId={clientId}
          apiPath="/api/reddit/opportunities"
          emptyMessage={
            section === "archive"
              ? "No archived threads yet."
              : "The daily scan runs at 6am UTC. Check back soon."
          }
        />
      </div>
    </div>
  );
}
