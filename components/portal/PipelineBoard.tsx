import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { getChangeTitle } from "@/lib/portal-labels";
import type { Change } from "@/lib/changes";

const MAX_VISIBLE = 5;

interface PipelineBoardProps {
  changes: Change[];
  token: string;
}

interface Column {
  key: string;
  label: string;
  color: string;
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
      borderColor: "border-t-amber-500",
      items: changes.filter((c) => getApproval(c) === "pending"),
    },
    {
      key: "approved",
      label: "Approved",
      color: "text-emerald-400",
      borderColor: "border-t-emerald-500",
      items: changes.filter(
        (c) => getApproval(c) === "approved" && !isComplete(c) && c.fields.execution_status !== "implementing"
      ),
    },
    {
      key: "implementing",
      label: "In Progress",
      color: "text-blue-400",
      borderColor: "border-t-blue-500",
      items: changes.filter((c) => c.fields.execution_status === "implementing" && !isComplete(c)),
    },
    {
      key: "complete",
      label: "Complete",
      color: "text-violet-400",
      borderColor: "border-t-violet-500",
      items: changes.filter((c) => isComplete(c)),
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((col) => {
        const visible = col.items.slice(0, MAX_VISIBLE);
        const overflow = col.items.length - MAX_VISIBLE;

        return (
          <div key={col.key}>
            <GlassCard className={`border-t-2 ${col.borderColor} p-4 h-full`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className={`text-xs font-semibold ${col.color}`}>
                  {col.items.length}
                </span>
              </div>

              {col.items.length === 0 ? (
                <div className="text-xs text-white/20 py-6 text-center">
                  Nothing here yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {visible.map((change) => {
                    const changeType = change.fields.type || change.fields.change_type;
                    return (
                      <div
                        key={change.id}
                        className="text-xs text-white/60 truncate py-1 px-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        {getChangeTitle(changeType, change.fields.page_url)}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-xs text-white/30 px-1.5 py-1">
                      +{overflow} more
                    </div>
                  )}
                </div>
              )}

              {col.key === "pending" && col.items.length > 0 && (
                <Link
                  href={`/portal/${token}/approvals`}
                  className="block text-xs text-violet-400 hover:text-violet-300 transition-colors mt-3 pt-3 border-t border-white/5"
                >
                  Review All &rarr;
                </Link>
              )}
            </GlassCard>
          </div>
        );
      })}
    </div>
  );
}
