import { getPendingApprovals } from "@/lib/changes";
import { getClients } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [changes, clients] = await Promise.all([
    getPendingApprovals(),
    getClients(),
  ]);

  // Build client lookup
  const clientMap: Record<string, string> = {};
  clients.forEach((c) => {
    clientMap[c.id] = c.fields.company_name;
  });

  // Group by client
  const byClient: Record<string, typeof changes> = {};
  changes.forEach((change) => {
    const clientId = change.fields.client_id?.[0] ?? "unknown";
    if (!byClient[clientId]) byClient[clientId] = [];
    byClient[clientId].push(change);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <p className="text-slate-500 text-sm mt-1">
          {changes.length} change{changes.length !== 1 ? "s" : ""} awaiting client decision
        </p>
      </div>

      {Object.keys(byClient).length === 0 && (
        <GlassCard>
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            No pending approvals — all caught up!
          </div>
        </GlassCard>
      )}

      {Object.entries(byClient).map(([clientId, clientChanges]) => (
        <section key={clientId}>
          <h2 className="text-sm font-medium text-slate-700 mb-3">
            {clientMap[clientId] ?? clientId}{" "}
            <span className="text-slate-400">({clientChanges.length})</span>
          </h2>
          <GlassCard>
            <div className="divide-y divide-slate-100">
              {clientChanges.map((change) => (
                <div key={change.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge value={change.fields.cat} variant="category" />
                      <span className="text-sm font-medium">{change.fields.type}</span>
                      <StatusBadge value={change.fields.confidence} variant="confidence" />
                      {change.fields.implementation_tier === "tier_1" && (
                        <span className="text-xs text-indigo-500">Tier 1</span>
                      )}
                    </div>
                    <StatusBadge value="pending" variant="approval" />
                  </div>
                  <div className="text-xs text-slate-500 font-mono mb-2">{change.fields.page_url}</div>
                  {change.fields.proposed_value && (
                    <div className="text-xs text-slate-600 line-clamp-2">{change.fields.proposed_value}</div>
                  )}
                  {change.fields.reasoning && (
                    <div className="text-xs text-slate-400 mt-1 line-clamp-1 italic">{change.fields.reasoning}</div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </section>
      ))}
    </div>
  );
}
