import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { MetricTile } from "@/components/ui/MetricTile";
import { GlassCard } from "@/components/ui/GlassCard";
import { OnboardingTracker } from "@/components/portal/OnboardingTracker";

export const revalidate = 0;

export default async function PortalDashboard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const [pending, reports, allChanges] = await Promise.all([
    getPendingApprovals(client.id),
    getClientReports(client.id),
    getClientChanges(client.id),
  ]);

  const status = client.fields.status || client.fields.plan_status || "form_submitted";
  const latestReport = reports[0];

  const implementedCount = allChanges.filter(
    (c) => (c.fields.approval === "approved" || c.fields.approval_status === "approved") && c.fields.approval !== "pending"
  ).length;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-white/90">
          {status === "form_submitted" || status === "onboarding_setup" || status === "month1_audit"
            ? "Welcome aboard"
            : "Your SEO Overview"}
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {status === "form_submitted" || status === "onboarding_setup" || status === "month1_audit"
            ? "Here's where things stand as we get your program set up."
            : "Here's what's happening with your SEO program."}
        </p>
      </div>

      {/* ─── Metric Tiles (always shown) ─── */}
      <div className="grid grid-cols-3 gap-4">
        <MetricTile
          label="Pending Approvals"
          value={pending.length}
          sub={pending.length === 0 ? "Nothing to review" : undefined}
          accent={pending.length > 0 ? "amber" : "emerald"}
        />
        <MetricTile
          label="Total Implemented"
          value={implementedCount}
          sub={implementedCount === 0 ? "Starting soon" : undefined}
          accent="violet"
        />
        <MetricTile
          label="Latest Report"
          value={latestReport ? `Month ${latestReport.fields.month}` : "Coming soon"}
          sub={latestReport?.fields.sent_at
            ? new Date(latestReport.fields.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : undefined}
          accent="blue"
        />
      </div>

      {/* ─── Status-aware content ─── */}

      {/* Onboarding statuses */}
      {(status === "form_submitted" || status === "onboarding_setup" || status === "month1_audit") && (
        <>
          <OnboardingTracker planStatus={status} />
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-sm text-blue-300">◎</div>
              <div>
                <div className="font-medium text-white/80">Your program is being set up</div>
                <div className="text-sm text-white/40">
                  We'll notify you when recommendations are ready.
                </div>
              </div>
            </div>
          </GlassCard>
        </>
      )}

      {/* Awaiting approval — no pending */}
      {status === "awaiting_approval" && pending.length === 0 && (
        <>
          <GlassCard className="p-5 border border-amber-400/15">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-sm text-amber-300">◎</div>
              <div>
                <div className="font-medium text-white/80">Your audit is complete</div>
                <div className="text-sm text-white/40">
                  Preparing recommendations for your review.
                </div>
              </div>
            </div>
          </GlassCard>
          <OnboardingTracker planStatus="awaiting_approval" />
        </>
      )}

      {/* Awaiting approval — has pending */}
      {status === "awaiting_approval" && pending.length > 0 && (
        <>
          <GlassCard className="p-5 border border-violet-400/20">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-white/90 mb-1">
                  {pending.length} recommendation{pending.length !== 1 ? "s" : ""} ready for your review
                </div>
                <div className="text-sm text-white/50">
                  Your initial audit is complete. Review and approve changes to kick off implementation.
                </div>
              </div>
              <Link
                href={`/portal/${token}/approvals`}
                className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-violet-600/40 border border-violet-400/30 text-sm font-medium text-white hover:bg-violet-500/50 transition-all"
              >
                Review now →
              </Link>
            </div>
          </GlassCard>
          <OnboardingTracker planStatus="awaiting_approval" />
        </>
      )}

      {/* Month1 implementing or active */}
      {(status === "month1_implementing" || status === "active") && (
        <>
          {/* Pending CTA */}
          {pending.length > 0 && (
            <GlassCard className="p-5 border border-violet-400/20">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-semibold text-white/90 mb-1">
                    {pending.length} recommendation{pending.length !== 1 ? "s" : ""} ready for your review
                  </div>
                  <div className="text-sm text-white/50">
                    Approve the ones you're happy with — implemented within 24 hours.
                  </div>
                </div>
                <Link
                  href={`/portal/${token}/approvals`}
                  className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-violet-600/40 border border-violet-400/30 text-sm font-medium text-white hover:bg-violet-500/50 transition-all"
                >
                  Review →
                </Link>
              </div>
            </GlassCard>
          )}

          {/* Latest report snapshot */}
          {latestReport && (
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

          {/* All caught up */}
          {pending.length === 0 && !latestReport && (
            <GlassCard className="p-8 text-center">
              <div className="text-2xl mb-3 text-violet-400/40">✦</div>
              <div className="font-medium text-white/80 mb-1">All caught up</div>
              <div className="text-sm text-white/40">
                No pending approvals. We'll notify you when new recommendations are ready.
              </div>
            </GlassCard>
          )}
        </>
      )}

      {/* Paused */}
      {status === "paused" && (
        <GlassCard className="p-8 text-center">
          <div className="font-medium text-white/80 mb-1">Your program is paused</div>
          <div className="text-sm text-white/40">Contact us for details.</div>
        </GlassCard>
      )}

      {/* Failed */}
      {status === "failed" && (
        <GlassCard className="p-8 text-center">
          <div className="font-medium text-white/80 mb-1">Something went wrong</div>
          <div className="text-sm text-white/40">Contact us for details.</div>
        </GlassCard>
      )}
    </div>
  );
}
