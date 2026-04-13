import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { getContentJobsForClient, getContentResultsForClient } from "@/lib/content";
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
      status: "implemented" | "reverting" | "reverted" | "approved" | "skipped" | "pending";
      cat: string;
      note?: string;
    }
  | { kind: "report"; date: string; month: number | string }
  | { kind: "content"; date: string; title: string; event: "proposed" | "approved" | "completed" | "published" };

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;

  const companyName = client.fields.company_name || "";

  const [changes, reports, contentJobs, contentResults] = await Promise.all([
    getClientChanges(clientId, recordId),
    getClientReports(clientId),
    getContentJobsForClient(companyName).catch(() => []),
    getContentResultsForClient(companyName).catch(() => []),
  ]);

  const entries: ChangelogEntry[] = [];

  for (const c of changes) {
    const changeType = c.fields.type || c.fields.change_type || "";
    const title = getChangeTitle(changeType, c.fields.page_url);
    const cat = c.fields.cat || c.fields.category || "Other";

    if (c.fields.reverted_at) {
      // Show the original implementation first, then the revert event
      if (c.fields.implemented_at) {
        entries.push({
          kind: "change",
          date: c.fields.implemented_at,
          title,
          pageUrl: c.fields.page_url || "",
          status: "implemented",
          cat,
        });
      }
      entries.push({
        kind: "change",
        date: c.fields.reverted_at,
        title,
        pageUrl: c.fields.page_url || "",
        status: "reverted",
        cat,
        note: c.fields.revert_note || undefined,
      });
    } else if (c.fields.execution_status === "reverting") {
      entries.push({
        kind: "change",
        date: c.fields.implemented_at || "",
        title,
        pageUrl: c.fields.page_url || "",
        status: "reverting",
        cat,
      });
    } else if (c.fields.implemented_at) {
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
      date: r.report_generated_at || "",
      month: r.month,
    });
  }

  // Content events from Content Jobs
  for (const job of contentJobs) {
    const blogTitle = job.fields["Blog Title"] || "Untitled";
    if (job.fields.title_status === "published" && job.fields.approved_at) {
      entries.push({ kind: "content", date: job.fields.approved_at, title: blogTitle, event: "published" });
    } else if (job.fields.approved_at) {
      entries.push({ kind: "content", date: job.fields.approved_at, title: blogTitle, event: "approved" });
    } else if (job.fields.proposed_at) {
      entries.push({ kind: "content", date: job.fields.proposed_at, title: blogTitle, event: "proposed" });
    }
  }

  // Completed articles from Results
  for (const result of contentResults) {
    const blogTitle = result.fields["Blog Title"] || "Untitled";
    const createdAt = result.fields["Created At"] || "";
    if (createdAt) {
      entries.push({ kind: "content", date: createdAt, title: blogTitle, event: "completed" });
    }
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
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case "implemented": return "Implemented";
      case "reverting": return "Reverting…";
      case "reverted": return "Reverted";
      case "approved": return "Approved";
      case "skipped": return "Skipped";
      default: return "Pending";
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "implemented": return "bg-indigo-50 border-indigo-200 text-indigo-700";
      case "reverting": return "bg-amber-50 border-amber-200 text-amber-700";
      case "reverted": return "bg-slate-100 border-slate-300 text-slate-500";
      case "approved": return "bg-emerald-50 border-emerald-200 text-emerald-700";
      case "skipped": return "bg-slate-100 border-slate-200 text-slate-600";
      default: return "bg-amber-50 border-amber-200 text-amber-700";
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Changelog</h1>
        <p className="text-base text-slate-500 mt-1">
          A record of all changes on your SEO program
        </p>
      </div>

      {entries.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-slate-400 text-sm">
            No changes yet. Activity will appear here once your audit is complete.
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="divide-y divide-slate-100">
            {/* Header row */}
            <div className="grid grid-cols-[160px_1fr_200px_120px_110px] gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <span>Date &amp; Time</span>
              <span>Change</span>
              <span>Page</span>
              <span>Category</span>
              <span>Status</span>
            </div>

            {entries.map((entry, i) => {
              if (entry.kind === "report") {
                return (
                  <div key={i} className="grid grid-cols-[160px_1fr_200px_120px_110px] gap-4 px-5 py-3.5 items-center">
                    <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                    <span className="text-sm font-medium text-slate-800">Monthly Report — Month {entry.month}</span>
                    <span className="text-xs text-slate-400 truncate">—</span>
                    <span className="text-xs text-slate-400">Report</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs border bg-blue-50 border-blue-200 text-blue-700">Delivered</span>
                  </div>
                );
              }

              if (entry.kind === "content") {
                const contentEventLabel: Record<string, string> = {
                  proposed: "Title Proposed",
                  approved: "Title Approved",
                  completed: "Article Ready",
                  published: "Article Published",
                };
                const contentEventColor: Record<string, string> = {
                  proposed: "bg-slate-100 border-slate-200 text-slate-600",
                  approved: "bg-emerald-50 border-emerald-200 text-emerald-700",
                  completed: "bg-indigo-50 border-indigo-200 text-indigo-700",
                  published: "bg-teal-50 border-teal-200 text-teal-700",
                };
                return (
                  <div key={i} className="grid grid-cols-[160px_1fr_200px_120px_110px] gap-4 px-5 py-3.5 items-center">
                    <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                    <span className="text-sm font-medium text-slate-800 truncate">{entry.title}</span>
                    <span className="text-xs text-slate-400 truncate">—</span>
                    <span className="text-xs text-slate-500">Content</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs border ${contentEventColor[entry.event]}`}>
                      {contentEventLabel[entry.event]}
                    </span>
                  </div>
                );
              }

              return (
                <div key={i} className={`grid grid-cols-[160px_1fr_200px_120px_110px] gap-4 px-5 py-3.5 items-center${entry.status === "reverted" ? " opacity-60" : ""}`}>
                  <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                  <div className="min-w-0">
                    <span className={`text-sm font-semibold truncate block${entry.status === "reverted" ? " line-through text-slate-400" : " text-slate-800"}`}>
                      {entry.title}
                    </span>
                    {entry.status === "reverted" && (
                      <span className="text-xs text-slate-400 italic">{entry.note || "Restored to original state"}</span>
                    )}
                    {entry.status === "reverting" && (
                      <span className="text-xs text-amber-600 italic">Restoring original — changes will disappear shortly</span>
                    )}
                  </div>
                  <a
                    href={entry.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-slate-600 font-mono truncate transition-colors"
                    title={entry.pageUrl}
                  >
                    {(() => { try { return new URL(entry.pageUrl).pathname; } catch { return entry.pageUrl; } })()}
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
