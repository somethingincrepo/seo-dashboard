import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const revalidate = 0;

type ActivityItem =
  | { kind: "change"; date: string; label: string; page: string; status: string; cat: string }
  | { kind: "report"; date: string; label: string; month: string | number };

export default async function ActivityPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const [changes, reports] = await Promise.all([
    getClientChanges(client.id),
    getClientReports(client.id),
  ]);

  // Build a unified activity feed
  const items: ActivityItem[] = [];

  for (const c of changes) {
    const approval = c.fields.approval || c.fields.approval_status;
    if (!approval || approval === "pending") continue;
    const date = c.fields.implemented_at || c.fields.approved_at || c.fields.identified_at || "";
    items.push({
      kind: "change",
      date,
      label: c.fields.type || c.fields.change_type || "Change",
      page: c.fields.page_url || "",
      status: approval,
      cat: c.fields.cat || c.fields.category || "Other",
    });
  }

  for (const r of reports) {
    items.push({
      kind: "report",
      date: r.fields.sent_at || "",
      label: `Month ${r.fields.month} report sent`,
      month: r.fields.month,
    });
  }

  // Sort by date descending (empty dates go last)
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  // Group by month label
  const grouped: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    let groupKey = "Earlier";
    if (item.date) {
      try {
        const d = new Date(item.date);
        groupKey = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } catch { /* ignore */ }
    }
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(item);
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return ""; }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-white/40 text-sm mt-1">Everything that&apos;s happened on your SEO program</p>
      </div>

      {items.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-white/30 text-sm">No activity yet. Activity will appear here as changes are approved and implemented.</div>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, monthItems]) => (
            <section key={month}>
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{month}</div>
              <GlassCard>
                <div className="divide-y divide-white/6">
                  {monthItems.map((item, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {item.kind === "report" ? (
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/20 flex items-center justify-center text-[10px] text-blue-300">◎</div>
                        ) : (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                            item.status === "approved" ? "bg-emerald-500/20 border border-emerald-400/20 text-emerald-300" :
                            item.status === "skipped" ? "bg-slate-500/20 border border-slate-400/20 text-slate-400" :
                            "bg-blue-500/20 border border-blue-400/20 text-blue-300"
                          }`}>
                            {item.status === "approved" ? "✓" : item.status === "skipped" ? "—" : "?"}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.kind === "change" && (
                            <StatusBadge value={item.cat} variant="category" />
                          )}
                          <span className="text-sm text-white/80">{item.label}</span>
                          {item.kind === "change" && (
                            <StatusBadge value={item.status} variant="approval" />
                          )}
                        </div>
                        {item.kind === "change" && item.page && (
                          <div className="text-xs text-white/30 font-mono mt-1 truncate">{item.page}</div>
                        )}
                      </div>

                      {/* Date */}
                      {item.date && (
                        <div className="text-xs text-white/25 flex-shrink-0">{formatDate(item.date)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
