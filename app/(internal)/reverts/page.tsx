import { airtableFetch } from "@/lib/airtable";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RevertActions } from "./RevertActions";

export const dynamic = "force-dynamic";

type ImplementedChange = {
  id: string;
  fields: {
    type: string;
    cat: string;
    page_url: string;
    current_value: string;
    proposed_value: string;
    change_title: string;
    priority: string;
    execution_status: string;
    implemented_at?: string;
    reverted_at?: string;
    revert_payload?: string;
    revert_note?: string;
    client_id?: string[];
  };
};

type ClientRecord = {
  id: string;
  fields: { company_name: string; cms?: string };
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  complete: { label: "Implemented", color: "text-emerald-700 bg-emerald-50" },
  reverting: { label: "Reverting…", color: "text-amber-700 bg-amber-50" },
  reverted: { label: "Reverted", color: "text-slate-500 bg-slate-100" },
  revert_failed: { label: "Revert failed", color: "text-red-700 bg-red-50" },
};

export default async function RevertsPage() {
  const authed = await getSession();
  if (!authed) redirect("/login");

  const changes = await airtableFetch<ImplementedChange>("Changes", {
    filterByFormula: `OR({execution_status}="complete",{execution_status}="reverting",{execution_status}="reverted",{execution_status}="revert_failed")`,
    sort: [{ field: "implemented_at", direction: "desc" }],
    maxRecords: 100,
  });

  const clientIds = [
    ...new Set(changes.map((c) => c.fields.client_id?.[0]).filter(Boolean)),
  ];
  const clientMap: Record<string, { name: string; cms: string }> = {};

  if (clientIds.length > 0) {
    const clients = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: `OR(${clientIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`,
      fields: ["company_name", "cms"],
    });
    for (const c of clients) {
      clientMap[c.id] = {
        name: c.fields.company_name,
        cms: c.fields.cms || "unknown",
      };
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Implemented Changes</h1>
        <p className="text-slate-500 text-sm mt-1">
          {changes.length} change{changes.length !== 1 ? "s" : ""} — revert any implementation to restore the original state
        </p>
      </div>

      {changes.length === 0 && (
        <GlassCard>
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            No completed implementations yet.
          </div>
        </GlassCard>
      )}

      <div className="space-y-3">
        {changes.map((change) => {
          const clientId = change.fields.client_id?.[0] ?? "";
          const client = clientMap[clientId];
          const statusInfo = STATUS_LABELS[change.fields.execution_status] ?? {
            label: change.fields.execution_status,
            color: "text-slate-600 bg-slate-50",
          };
          const hasRevertPayload = !!change.fields.revert_payload?.trim();

          return (
            <GlassCard key={change.id}>
              <div className="px-5 py-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge value={change.fields.cat} variant="category" />
                    <span className="text-sm font-semibold">{change.fields.type}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-slate-700">
                      {client?.name ?? clientId}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{client?.cms ?? "—"}</div>
                  </div>
                </div>

                {/* Page + title */}
                <div>
                  {change.fields.change_title && (
                    <div className="text-sm font-medium text-slate-800 mb-0.5">
                      {change.fields.change_title}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 font-mono">{change.fields.page_url}</div>
                </div>

                {/* Timestamps */}
                <div className="flex gap-6 text-xs text-slate-400">
                  {change.fields.implemented_at && (
                    <span>
                      Implemented:{" "}
                      {new Date(change.fields.implemented_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {change.fields.reverted_at && (
                    <span>
                      Reverted:{" "}
                      {new Date(change.fields.reverted_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                {/* What changed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-red-600 mb-1">Was (before implementation)</div>
                    <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all">
                      {change.fields.current_value || "(empty)"}
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-emerald-700 mb-1">Now (implemented)</div>
                    <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all">
                      {change.fields.proposed_value || "(empty)"}
                    </div>
                  </div>
                </div>

                {/* Revert note (if reverted) */}
                {change.fields.revert_note && (
                  <div className="text-xs text-slate-500 italic">{change.fields.revert_note}</div>
                )}

                {/* Revert action — only show for complete or revert_failed */}
                {(change.fields.execution_status === "complete" ||
                  change.fields.execution_status === "revert_failed") && (
                  <RevertActions
                    changeId={change.id}
                    hasRevertPayload={hasRevertPayload}
                  />
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
