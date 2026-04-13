import { airtableFetch } from "@/lib/airtable";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DesignReviewActions } from "./DesignReviewActions";

export const dynamic = "force-dynamic";

type DesignReviewChange = {
  id: string;
  fields: {
    type: string;
    cat: string;
    page_url: string;
    current_value: string;
    proposed_value: string;
    reasoning: string;
    change_title: string;
    priority: string;
    confidence: string;
    implementation_tier: string;
    approval: string;
    execution_status: string;
    requires_design_review: boolean;
    client_id: string[];
    page_builder?: string;
    plain_english_explanation?: string;
  };
};

type ClientRecord = {
  id: string;
  fields: { company_name: string; cms?: string; page_builder?: string };
};

export default async function DesignReviewPage() {
  const authed = await getSession();
  if (!authed) redirect("/login");

  const changes = await airtableFetch<DesignReviewChange>("Changes", {
    filterByFormula: `AND({approval}="approved",{requires_design_review}=TRUE(),OR({execution_status}="design_review_required",{execution_status}="pending"))`,
    sort: [{ field: "priority", direction: "asc" }],
  });

  // Load client names for display
  const clientIds = [...new Set(changes.map((c) => c.fields.client_id?.[0]).filter(Boolean))];
  const clientMap: Record<string, { name: string; cms: string }> = {};

  if (clientIds.length > 0) {
    const clients = await airtableFetch<ClientRecord>("Clients", {
      filterByFormula: `OR(${clientIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`,
      fields: ["company_name", "cms", "page_builder"],
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
        <h1 className="text-2xl font-semibold">Design Review Queue</h1>
        <p className="text-slate-500 text-sm mt-1">
          {changes.length} change{changes.length !== 1 ? "s" : ""} awaiting design review — client approved but requires visual verification before implementation
        </p>
      </div>

      {changes.length === 0 && (
        <GlassCard>
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            No changes pending design review — all clear!
          </div>
        </GlassCard>
      )}

      <div className="space-y-4">
        {changes.map((change) => {
          const clientId = change.fields.client_id?.[0] ?? "";
          const client = clientMap[clientId];
          return (
            <GlassCard key={change.id}>
              <div className="px-5 py-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge value={change.fields.cat} variant="category" />
                      <span className="text-sm font-semibold">{change.fields.type}</span>
                      <StatusBadge value={change.fields.priority} variant="priority" />
                      <StatusBadge value={change.fields.confidence} variant="confidence" />
                    </div>
                    <div className="text-xs text-slate-500 font-mono">{change.fields.page_url}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-slate-700">{client?.name ?? clientId}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{client?.cms ?? "—"}</div>
                  </div>
                </div>

                {/* Change title */}
                {change.fields.change_title && (
                  <div className="text-sm font-medium text-slate-800">{change.fields.change_title}</div>
                )}

                {/* Current vs Proposed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-red-600 mb-1">Current</div>
                    <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all">
                      {change.fields.current_value || "(empty)"}
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-emerald-700 mb-1">Proposed</div>
                    <div className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all">
                      {change.fields.proposed_value || "(empty)"}
                    </div>
                  </div>
                </div>

                {/* Why flagged */}
                {change.fields.reasoning && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-amber-700 mb-1">Why design review is required</div>
                    <div className="text-xs text-slate-700">{change.fields.reasoning}</div>
                  </div>
                )}

                {/* Plain english */}
                {change.fields.plain_english_explanation && (
                  <div className="text-xs text-slate-500 italic">{change.fields.plain_english_explanation}</div>
                )}

                {/* Actions */}
                <DesignReviewActions changeId={change.id} clientId={clientId} />
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
