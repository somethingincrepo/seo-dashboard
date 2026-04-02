import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getChangeTitle } from "@/lib/portal-labels";

export const revalidate = 0;

type ChangelogEntry =
  | {
      kind: "change";
      date: string;
      title: string;
      pageUrl: string;
      status: "implemented" | "approved" | "skipped" | "pending";
      cat: string;
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

  const entries: ChangelogEntry[] = [];

  for (const c of changes) {
    const changeType = c.fields.type || c.fields.change_type || "";
    const title = getChangeTitle(changeType, c.fields.page_url);
    const cat = c.fields.cat || c.fields.category || "Other";

    if (c.fields.implemented_at) {
      entries.push({
        kind: "change",
        date: c.fields.implemented_at,
        title,
        pageUrl: c.fields.page_url || "",
        status: "implemented",
        cat,
      });
    } else if (c.fields.approved_at) {
      entries.push({
        kind: "change",
        date: c.fields.approved_at,
        title,
        pageUrl: c.fields.page_url || "",
        status: "approved",
        cat,
      });
    } else {
      const approval = c.fields.approval || c.fields.approval_status;
      if (approval === "skipped") {
        entries.push({
          kind: "change",
          date: c.fields.identified_at || "",
          title,
          pageUrl: c.fields.page_url || "",
          status: "skipped",
          cat,
        });
      } else {
        entries.push({
          kind: "change",
          date: c.fields.identified_at || "",
          title,
          pageUrl: c.fields.page_url || "",
          status: "pending",
          cat,
        });
      }
    }
  }

  for (const r of reports) {
    entries.push({
      kind: "report",
      date: r.fields.sent_at || "",
      month: r.fields.month,
    });
  }

  entries.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  function formatDate(dateStr: string) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case "implemented":
        return "Implemented";
      case "approved":
        return "Approved";
      case "skipped":
        return "Skipped";
      default:
        return "Pending";
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "implemented":
        return "bg-violet-500/15 border-violet-400/20 text-violet-300";
      case "approved":
        return "bg-emerald-500/15 border-emerald-400/20 text-emerald-300";
      case "skipped":
        return "bg-slate-500/15 border-slate-400/20 text-slate-400";
      default:
        return "bg-amber-500/15 border-amber-400/20 text-amber-300";
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white/90">Changelog</h1>
        <p className="text-base text-white/40 mt-1">
          A record of all changes on your SEO program
        </p>
      </div>

      {entries.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-white/30 text-sm">
            No changes yet. Activity will appear here once your audit is complete.
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="divide-y divide-white/[0.06]">
            {/* Header row */}
            <div className="grid grid-cols-[140px_1fr_200px_120px_110px] gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white/25">
              <span>Date</span>
              <span>Change</span>
              <span>Page</span>
              <span>Category</span>
              <span>Status</span>
            </div>

            {entries.map((entry, i) => {
              if (entry.kind === "report") {
                return (
                  <div key={i} className="grid grid-cols-[140px_1fr_200px_120px_110px] gap-4 px-5 py-3.5 items-center">
                    <span className="text-xs text-white/40">
                      {formatDate(entry.date)}
                    </span>
                    <span className="text-sm font-medium text-white/70">
                      Monthly Report — Month {entry.month}
                    </span>
                    <span className="text-xs text-white/30 truncate">—</span>
                    <span className="text-xs text-white/30">Report</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs border bg-blue-500/15 border-blue-400/20 text-blue-300`}>
                      Delivered
                    </span>
                  </div>
                );
              }

              return (
                <div key={i} className="grid grid-cols-[140px_1fr_200px_120px_110px] gap-4 px-5 py-3.5 items-center">
                  <span className="text-xs text-white/40">
                    {formatDate(entry.date)}
                  </span>
                  <span className="text-sm font-semibold text-white/80 truncate">
                    {entry.title}
                  </span>
                  <a
                    href={entry.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-white/30 hover:text-white/50 font-mono truncate transition-colors"
                    title={entry.pageUrl}
                  >
                    {(() => {
                      try { return new URL(entry.pageUrl).pathname; }
                      catch { return entry.pageUrl; }
                    })()}
                  </a>
                  <StatusBadge value={entry.cat} variant="category" />
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs border ${statusColor(entry.status)}`}>
                    {statusLabel(entry.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
