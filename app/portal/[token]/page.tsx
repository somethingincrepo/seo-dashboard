import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { MetricTile } from "@/components/ui/MetricTile";
import { GlassCard } from "@/components/ui/GlassCard";
import { OnboardingTracker } from "@/components/portal/OnboardingTracker";
import { PipelineBoard } from "@/components/portal/PipelineBoard";

export const revalidate = 0;

const ONBOARDING_STATUSES = ["form_submitted", "onboarding_setup", "month1_audit", "awaiting_approval", "month1_implementing"];
const ACTIVE_STATUSES = ["active"];

export default async function PortalDashboard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;

  const [pending, reports, allChanges] = await Promise.all([
    getPendingApprovals(clientId),
    getClientReports(clientId),
    getClientChanges(clientId),
  ]);

  const status = client.fields.status || client.fields.plan_status || "form_submitted";
  const latestReport = reports[0];
  const isOnboarding = ONBOARDING_STATUSES.includes(status);
  const isActive = ACTIVE_STATUSES.includes(status);

  const implementedCount = allChanges.filter(
    (c) => c.fields.execution_status === "complete" || !!c.fields.implemented_at
  ).length;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-white/90">
          {isOnboarding ? "Welcome aboard" : "Your SEO Overview"}
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {isOnboarding
            ? "Here's where things stand as we get your program set up."
            : "Here's what's happening with your SEO program."}
        </p>
      </div>

      {/* ─── Metric Tiles ─── */}
      <div className="grid grid-cols-3 gap-4">
        <MetricTile
          label="Pending Approvals"
          value={pending.length}
          sub={pending.length === 0 ? "Nothing to review" : undefined}
          accent={pending.length > 0 ? "amber" : "emerald"}
        />
        <MetricTile
          label="Implemented"
          value={implementedCount}
          sub={implementedCount === 0 ? "Starting soon" : undefined}
          accent="violet"
        />
        {isActive ? (
          <MetricTile
            label="Latest Report"
            value={latestReport ? `Month ${latestReport.fields.month}` : "Coming soon"}
            sub={latestReport?.fields.sent_at
              ? new Date(latestReport.fields.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : undefined}
            accent="blue"
          />
        ) : (
          <MetricTile
            label="Month"
            value={`Month ${client.fields.month_number || 1}`}
            sub="Your program progress"
            accent="blue"
          />
        )}
      </div>

      {/* ─── Pipeline Board ─── */}
      {allChanges.length > 0 && (
        <section>
          <div className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Pipeline
          </div>
          <PipelineBoard changes={allChanges} token={token} />
        </section>
      )}

      {/* ─── Onboarding: Tracker at bottom ─── */}
      {isOnboarding && (
        <GlassCard className="p-6">
          <OnboardingTracker planStatus={status} />
        </GlassCard>
      )}

      {/* ─── Active: Latest report snapshot ─── */}
      {isActive && latestReport && (
        <section>
          <div className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Latest Report — Month {latestReport.fields.month}
          </div>
          <GlassCard className="p-5">
            <div className="grid grid-cols-3 gap-6 text-center mb-4">
              {[
                { val: latestReport.fields.gsc_clicks_delta, label: "Clicks" },
                { val: latestReport.fields.gsc_impressions_delta, label: "Impressions" },
                { val: latestReport.fields.ai_citation_score, label: "AI Score", noSign: true },
              ].map(({ val, label, noSign }) => (
                <div key={label}>
                  <div className={`text-2xl font-bold ${
                    noSign ? "text-blue-400" :
                    (val ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {val == null ? "—" : noSign ? val : `${val >= 0 ? "+" : ""}${val}`}
                  </div>
                  <div className="text-white/30 text-xs mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <Link href={`/portal/${token}/reports`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                View all reports →
              </Link>
              {latestReport.fields.pdf_url && (
                <a href={latestReport.fields.pdf_url} target="_blank" rel="noreferrer"
                  className="text-xs text-white/40 hover:text-white/60 transition-colors">
                  Download PDF ↗
                </a>
              )}
            </div>
          </GlassCard>
        </section>
      )}

      {/* Active + no pending + no report */}
      {isActive && pending.length === 0 && !latestReport && (
        <GlassCard className="p-8 text-center">
          <div className="text-2xl mb-3 text-violet-400/40">✦</div>
          <div className="font-medium text-white/80 mb-1">All caught up</div>
          <div className="text-sm text-white/40">
            No pending approvals. We'll notify you when new recommendations are ready.
          </div>
        </GlassCard>
      )}

      {/* Paused / Failed */}
      {(status === "paused" || status === "failed") && (
        <GlassCard className="p-8 text-center">
          <div className="font-medium text-white/80 mb-1">
            {status === "paused" ? "Your program is paused" : "Something went wrong"}
          </div>
          <div className="text-sm text-white/40">Contact us for details.</div>
        </GlassCard>
      )}
    </div>
  );
}
