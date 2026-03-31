import Link from "next/link";
import { getClients } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  "form_submitted",
  "onboarding_setup",
  "month1_audit",
  "awaiting_approval",
  "month1_implementing",
  "active",
];

function PipelineBar({ status }: { status: string }) {
  const idx = PIPELINE_STAGES.indexOf(status);
  const pct = idx < 0 ? 0 : Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-white/30 mb-1">
        <span>Pipeline</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-teal-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-white/40 text-sm mt-1">{clients.length} clients total</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => (
          <Link key={client.id} href={`/clients/${client.id}`}>
            <GlassCard hover className="p-5 h-full">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-sm leading-tight">{client.fields.company_name}</div>
                <StatusBadge value={client.fields.plan_status || "form_submitted"} variant="plan_status" />
              </div>
              <div className="text-white/35 text-xs truncate">{client.fields.site_url}</div>
              <div className="text-white/25 text-xs mt-1">{client.fields.cms}</div>
              <PipelineBar status={client.fields.plan_status} />
              {client.fields.portal_token && (
                <div className="mt-3 text-xs text-white/20">
                  Portal: /portal/{client.fields.portal_token.slice(0, 8)}…
                </div>
              )}
            </GlassCard>
          </Link>
        ))}
        {clients.length === 0 && (
          <div className="col-span-3 text-center py-16 text-white/30 text-sm">
            No clients yet. Add clients to Airtable to get started.
          </div>
        )}
      </div>
    </div>
  );
}
