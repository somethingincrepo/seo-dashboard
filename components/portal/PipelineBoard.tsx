import Link from "next/link";
import { getListItemTitle } from "@/lib/portal-labels";
import type { Change } from "@/lib/changes";

const MAX_VISIBLE = 3;

interface PipelineBoardProps {
  changes: Change[];
  token: string;
}

interface Column {
  key: string;
  label: string;
  color: string;
  dotColor: string;
  borderColor: string;
  items: Change[];
}

export function PipelineBoard({ changes, token }: PipelineBoardProps) {
  const getApproval = (c: Change) => c.fields.approval || c.fields.approval_status;
  const isComplete = (c: Change) =>
    c.fields.execution_status === "complete" || !!c.fields.implemented_at;

  const columns: Column[] = [
    {
      key: "pending",
      label: "Pending Review",
      color: "text-amber-400",
      dotColor: "bg-amber-400",
      borderColor: "border-t-amber-500",
      items: changes.filter((c) => getApproval(c) === "pending"),
    },
    {
      key: "approved",
      label: "Approved",
      color: "text-emerald-400",
      dotColor: "bg-emerald-400",
      borderColor: "border-t-emerald-500",
      items: changes.filter(
        (c) =>
          getApproval(c) === "approved" &&
          !isComplete(c) &&
          c.fields.execution_status !== "implementing"
      ),
    },
    {
      key: "implementing",
      label: "In Progress",
      color: "text-blue-400",
      dotColor: "bg-blue-400",
      borderColor: "border-t-blue-500",
      items: changes.filter(
        (c) => c.fields.execution_status === "implementing" && !isComplete(c)
      ),
    },
    {
      key: "complete",
      label: "Complete",
      color: "text-violet-400",
      dotColor: "bg-violet-400",
      borderColor: "border-t-violet-500",
      items: changes.filter((c) => isComplete(c)),
    },
  ];

  const tier1Pending = columns[0].items.filter(
    (c) => c.fields.implementation_tier === "tier_1"
  );

  function extractPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url || "/";
    }
  }

  function formatDate(dateStr: string): string {
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

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((col) => {
        const visible = col.items.slice(0, MAX_VISIBLE);
        const overflow = col.items.length - MAX_VISIBLE;

        return (
          <div key={col.key} className={`bg-white/[0.03] rounded-2xl p-4 flex flex-col border-t-2 ${col.borderColor} min-h-[320px]`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                {col.label}
              </span>
              <span className={`text-xs font-bold ${col.color}`}>
                {col.items.length}
              </span>
            </div>

            {col.items.length === 0 ? (
              <div className="text-xs text-white/20 py-8 text-center flex-1">
                Nothing here yet
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {visible.map((change) => {
                  const changeType = change.fields.type || change.fields.change_type;
                  const cat = change.fields.cat || change.fields.category || "";
                  const path = extractPath(change.fields.page_url);
                  const isPending = col.key === "pending";

                  return (
                    <div key={change.id}>
                      {isPending ? (
                        <Link
                          href={`/portal/${token}/approvals?selected=${change.id}`}
                          className="block bg-white/[0.05] hover:bg-white/[0.08] rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
                        >
                          <div className="text-xs font-medium text-white/70 group-hover:text-white/90 truncate">
                            {getListItemTitle(changeType, change.fields.page_url, 28)}
                          </div>
                          <div className="text-[11px] text-white/25 mt-0.5 truncate">
                            {path}
                          </div>
                        </Link>
                      ) : (
                        <div
                          className="bg-white/[0.05] hover:bg-white/[0.08] rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
                          title={
                            col.key === "approved" && change.fields.approved_at
                              ? `Approved on ${formatDate(change.fields.approved_at)}`
                              : undefined
                          }
                        >
                          <div className="text-xs font-medium text-white/70 group-hover:text-white/90 truncate">
                            {getListItemTitle(changeType, change.fields.page_url, 28)}
                          </div>
                          <div className="text-[11px] text-white/25 mt-0.5 truncate">
                            {path}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <Link
                    href={col.key === "pending" ? `/portal/${token}/approvals` : `/portal/${token}/activity`}
                    className="block text-xs text-white/20 hover:text-white/40 px-3 py-1 mt-2 transition-colors duration-150"
                  >
                    +{overflow} more
                  </Link>
                )}
              </div>
            )}

            {/* Footer: Review All + Quick Wins for pending column */}
            {col.key === "pending" && col.items.length > 0 && (
              <div className="mt-auto pt-3 border-t border-white/[0.06] space-y-2">
                {tier1Pending.length > 0 && (
                  <Link
                    href={`/portal/${token}/approvals`}
                    className="block text-xs py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/15 text-emerald-300/70 hover:bg-emerald-500/25 hover:text-emerald-300 transition-all duration-150 w-full text-center"
                  >
                    Approve {tier1Pending.length} Quick Win{tier1Pending.length !== 1 ? "s" : ""}
                  </Link>
                )}
                <Link
                  href={`/portal/${token}/approvals`}
                  className="block text-xs text-violet-400/70 hover:text-violet-400 transition-colors duration-150"
                >
                  Review All →
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
