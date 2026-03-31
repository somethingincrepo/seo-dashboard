import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getChangeTitle } from "@/lib/portal-labels";

export const revalidate = 0;

type TimelineEntry =
  | {
      kind: "change";
      date: string;
      title: string;
      pageUrl: string;
      actionLabel: string;
      actionStatus: "implemented" | "approved" | "skipped" | "question" | "pending";
      cat: string;
      questionText?: string;
    }
  | { kind: "report"; date: string; month: number | string };

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;

  const [changes, reports] = await Promise.all([
    getClientChanges(clientId),
    getClientReports(clientId),
  ]);

  const entries: TimelineEntry[] = [];

  // Process changes
  for (const c of changes) {
    const approval = c.fields.approval || c.fields.approval_status;
    const changeType = c.fields.type || c.fields.change_type || "";
    const title = getChangeTitle(changeType, c.fields.page_url);
    const cat = c.fields.cat || c.fields.category || "Other";

    if (c.fields.implemented_at) {
      entries.push({
        kind: "change",
        date: c.fields.implemented_at,
        title,
        pageUrl: c.fields.page_url || "",
        actionLabel: "Implemented",
        actionStatus: "implemented",
        cat,
      });
    } else if (c.fields.approved_at) {
      entries.push({
        kind: "change",
        date: c.fields.approved_at,
        title,
        pageUrl: c.fields.page_url || "",
        actionLabel: "Approved",
        actionStatus: "approved",
        cat,
      });
    } else if (approval === "skipped") {
      entries.push({
        kind: "change",
        date: c.fields.identified_at || "",
        title,
        pageUrl: c.fields.page_url || "",
        actionLabel: "Skipped",
        actionStatus: "skipped",
        cat,
      });
    } else if (approval === "question" && c.fields.client_notes) {
      entries.push({
        kind: "change",
        date: c.fields.identified_at || c.fields.approved_at || "",
        title,
        pageUrl: c.fields.page_url || "",
        actionLabel: "Question submitted",
        actionStatus: "question",
        cat,
        questionText: c.fields.client_notes,
      });
    } else if (approval === "pending") {
      entries.push({
        kind: "change",
        date: c.fields.identified_at || "",
        title,
        pageUrl: c.fields.page_url || "",
        actionLabel: "Recommendation identified",
        actionStatus: "pending",
        cat,
      });
    }
  }

  // Process reports
  for (const r of reports) {
    entries.push({
      kind: "report",
      date: r.fields.sent_at || "",
      month: r.fields.month,
    });
  }

  // Sort newest first (empty dates to bottom)
  entries.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  // Group by month
  const grouped: Record<string, TimelineEntry[]> = {};
  for (const entry of entries) {
    let key = "Earlier";
    if (entry.date) {
      try {
        const d = new Date(entry.date);
        key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } catch {
        /* ignore */
      }
    }
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  function dotColor(status: string) {
    switch (status) {
      case "implemented":
        return "bg-violet-400";
      case "approved":
        return "bg-emerald-400";
      case "skipped":
        return "bg-slate-400";
      case "question":
        return "bg-blue-400";
      case "pending":
        return "bg-amber-400";
      default:
        return "bg-slate-500";
    }
  }

  function dotIcon(status: string) {
    switch (status) {
      case "implemented":
        return "✓";
      case "approved":
        return "✓";
      case "skipped":
        return "—";
      case "question":
        return "?";
      default:
        return "";
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white/90">Activity</h1>
        <p className="text-white/40 text-sm mt-1">
          Everything that&apos;s happened on your SEO program
        </p>
      </div>

      {entries.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-white/30 text-sm">
            No activity yet. Activity will appear here as changes are approved
            and implemented.
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, monthEntries]) => (
            <section key={month}>
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
                {month}
              </div>
              <GlassCard>
                <div className="divide-y divide-white/6">
                  {monthEntries.map((entry, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-4">
                      {/* Colored dot */}
                      <div className="flex-shrink-0 mt-0.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                            entry.kind === "report"
                              ? "bg-blue-500/20 border border-blue-400/20 text-blue-300"
                              : `${dotColor(entry.actionStatus).replace("bg-", "bg-").replace("/400", "/20")} border ${dotColor(entry.actionStatus).replace("bg-", "border-").replace("/400", "/20")} text-white/70`
                          }`}
                        >
                          {entry.kind === "report"
                            ? "◎"
                            : dotIcon(entry.actionStatus)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {entry.kind === "report" ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-white/80">
                              Monthly Report — Month {entry.month}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge
                                value={entry.cat}
                                variant="category"
                              />
                              <span className="text-sm text-white/80">
                                {entry.title}
                              </span>
                              <span className="text-xs text-white/30">
                                {entry.actionLabel}
                              </span>
                            </div>
                            {entry.pageUrl && (
                              <div className="text-xs text-white/30 font-mono mt-1 truncate">
                                {entry.pageUrl}
                              </div>
                            )}
                            {entry.questionText && (
                              <div className="mt-2 px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-400/10">
                                <div className="text-xs text-blue-300/70">
                                  &ldquo;{entry.questionText}&rdquo;
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Date */}
                      {entry.date && (
                        <div className="text-xs text-white/25 flex-shrink-0">
                          {formatDate(entry.date)}
                        </div>
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
