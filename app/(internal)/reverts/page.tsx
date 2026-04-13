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

type StatusInfo = { label: string; color: string; dot: string };

const STATUS_INFO: Record<string, StatusInfo> = {
  complete:      { label: "Implemented", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  reverting:     { label: "Reverting…",  color: "text-amber-700 bg-amber-50 border-amber-200",     dot: "bg-amber-400" },
  reverted:      { label: "Reverted",    color: "text-slate-500 bg-slate-100 border-slate-200",    dot: "bg-slate-400" },
  revert_failed: { label: "Revert failed", color: "text-red-700 bg-red-50 border-red-200",         dot: "bg-red-500" },
};

export default async function RevertsPage() {
  const authed = await getSession();
  if (!authed) redirect("/login");

  const changes = await airtableFetch<ImplementedChange>("Changes", {
    filterByFormula: `OR({execution_status}="complete",{execution_status}="reverting",{execution_status}="reverted",{execution_status}="revert_failed")`,
    sort: [{ field: "implemented_at", direction: "desc" }],
    maxRecords: 200,
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

  // Group by status for better scannability
  const active = changes.filter((c) => c.fields.execution_status === "complete");
  const inProgress = changes.filter((c) => c.fields.execution_status === "reverting");
  const done = changes.filter((c) => c.fields.execution_status === "reverted" || c.fields.execution_status === "revert_failed");

  function formatTs(ts?: string) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  function ChangeCard({ change }: { change: typeof changes[0] }) {
    const clientId = change.fields.client_id?.[0] ?? "";
    const client = clientMap[clientId];
    const status = change.fields.execution_status as keyof typeof STATUS_INFO;
    const statusInfo = STATUS_INFO[status] ?? { label: status, color: "text-slate-600 bg-slate-50 border-slate-200", dot: "bg-slate-400" };
    const hasRevertPayload = !!change.fields.revert_payload?.trim();

    return (
      <GlassCard>
        <div className="px-5 py-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`w-2 h-2 rounded-full ${statusInfo.dot} shrink-0`} />
              <StatusBadge value={change.fields.cat} variant="category" />
              <span className="text-sm font-semibold">{change.fields.type}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-medium text-slate-700">{client?.name ?? clientId}</div>
              <div className="text-xs text-slate-400 mt-0.5">{client?.cms ?? "—"}</div>
            </div>
          </div>

          {/* Title + URL */}
          <div>
            {change.fields.change_title && (
              <div className="text-sm font-medium text-slate-800 mb-0.5">{change.fields.change_title}</div>
            )}
            <div className="text-xs text-slate-500 font-mono">{change.fields.page_url}</div>
          </div>

          {/* Before / After */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs font-medium text-red-600 mb-1">Before (original)</div>
              <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all line-clamp-4">
                {change.fields.current_value || "(empty)"}
              </div>
            </div>
            <div className={`rounded-lg p-3 ${status === "reverted" ? "bg-slate-50" : "bg-emerald-50"}`}>
              <div className={`text-xs font-medium mb-1 ${status === "reverted" ? "text-slate-400 line-through" : "text-emerald-700"}`}>
                {status === "reverted" ? "Implemented (reverted)" : "Implemented"}
              </div>
              <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all line-clamp-4">
                {change.fields.proposed_value || "(empty)"}
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex gap-6 text-xs text-slate-400">
            {change.fields.implemented_at && (
              <span>Implemented: {formatTs(change.fields.implemented_at)}</span>
            )}
            {change.fields.reverted_at && (
              <span>Reverted: {formatTs(change.fields.reverted_at)}</span>
            )}
          </div>

          {/* Revert note */}
          {change.fields.revert_note && (
            <div className="text-xs text-slate-500 italic">{change.fields.revert_note}</div>
          )}

          {/* No revert payload warning */}
          {status === "complete" && !hasRevertPayload && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Implemented before the revert system was in place — revert payload not available. Manual revert required.
            </div>
          )}

          {/* Actions */}
          <RevertActions
            changeId={change.id}
            executionStatus={status as "complete" | "reverting" | "reverted" | "revert_failed"}
            hasRevertPayload={hasRevertPayload}
          />
        </div>
      </GlassCard>
    );
  }

  const totalCount = changes.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Implemented Changes</h1>
        <p className="text-slate-500 text-sm mt-1">
          {totalCount} change{totalCount !== 1 ? "s" : ""} — revert any implementation to restore the exact original state
        </p>
      </div>

      {totalCount === 0 && (
        <GlassCard>
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            No completed implementations yet.
          </div>
        </GlassCard>
      )}

      {/* In-progress reverts — show first */}
      {inProgress.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Reverting now ({inProgress.length})</h2>
          {inProgress.map((c) => <ChangeCard key={c.id} change={c} />)}
        </div>
      )}

      {/* Active — can be reverted */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Live on site — revertable ({active.length})</h2>
          {active.map((c) => <ChangeCard key={c.id} change={c} />)}
        </div>
      )}

      {/* Done — reverted or failed */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Reverted / failed ({done.length})</h2>
          {done.map((c) => <ChangeCard key={c.id} change={c} />)}
        </div>
      )}
    </div>
  );
}
