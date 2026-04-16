import Link from "next/link";
import { getClients } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";

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
      <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://seo-dashboard-1gdt74e5t-reporting-9449s-projects.vercel.app";
  const intakeUrl = `${baseUrl}/intake`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-slate-500 text-sm mt-1">{clients.length} clients</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Intake form link — share with prospects */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <span className="text-xs text-slate-400 font-mono">/intake</span>
            <CopyButton value={intakeUrl} label="Copy intake link" />
          </div>
          <Link
            href="/clients/new"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            + New Client
          </Link>
        </div>
      </div>

      {clients.length === 0 && (
        <GlassCard className="p-12 text-center">
          <div className="text-slate-400 text-sm">
            No clients yet. Add clients to your Airtable Clients table to get started.
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => {
          const portalUrl = client.fields.portal_token
            ? `${baseUrl}/portal/${client.fields.portal_token}`
            : null;

          return (
            <GlassCard key={client.id} className="p-5">
              {/* Header row */}
              <Link href={`/clients/${client.id}`} className="block mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm leading-tight hover:text-indigo-600 transition-colors">
                    {client.fields.company_name}
                  </div>
                  <StatusBadge value={client.fields.plan_status || "form_submitted"} variant="plan_status" />
                </div>
                <div className="text-slate-500 text-xs mt-1 truncate">{client.fields.site_url}</div>
                <div className="text-slate-400 text-xs">{client.fields.cms}</div>
                <PipelineBar status={client.fields.plan_status} />
              </Link>

              {/* Portal link row */}
              <div className="pt-3 border-t border-slate-200">
                {portalUrl ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 flex-1 truncate font-mono">
                      /portal/{client.fields.portal_token?.slice(0, 12)}…
                    </span>
                    <CopyButton value={portalUrl} label="Copy portal link" />
                  </div>
                ) : (
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-xs text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    ⚠ No portal token — click to generate
                  </Link>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
