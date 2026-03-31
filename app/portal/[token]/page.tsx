import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { getClientReports } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { OnboardingTracker } from "@/components/portal/OnboardingTracker";

export const revalidate = 0;

// Anything before "active" shows the onboarding tracker
const ONBOARDING_STATUSES = new Set([
  "form_submitted",
  "onboarding_setup",
  "month1_audit",
  "awaiting_approval",
  "month1_implementing",
]);

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
  const isOnboarding = ONBOARDING_STATUSES.has(status);
  const isActive = status === "active";
  const latestReport = reports[0];

  const implementedCount = allChanges.filter(
    (c) => (c.fields.approval === "approved" || c.fields.approval_status === "approved") && c.fields.approval !== "pending"
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

      {/* ─── Onboarding path ─── */}
      {isOnboarding && (
        <>
          <OnboardingTracker planStatus={status} />

          {/* CTA: pending approvals */}
          {pending.length > 0 ? (
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
          ) : status === "awaiting_approval" ? (
            <GlassCard className="p-5 border border-amber-400/15">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-sm text-amber-300">◎</div>
                <div>
                  <div className="font-medium text-white/80">Preparing your recommendations</div>
                  <div className="text-sm text-white/40">
                    Your initial audit is in progress. We'll notify you as soon as recommendations are ready for review.
                  </div>
                </div>
              </div>
            </GlassCard>
          ) : null}
        </>
      )}

      {/* ─── Active client path ─── */}
      {isActive && (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-4">
            <GlassCard className="p-5">
              <div className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Pending Approvals</div>
              <div className={`text-3xl font-bold ${pending.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {pending.length}
              </div>
              {pending.length === 0 && (
                <div className="text-white/25 text-xs mt-1">Nothing to review</div>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <div className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Changes Implemented</div>
              <div className="text-3xl font-bold text-violet-400">{implementedCount}</div>
              {implementedCount === 0 && (
                <div className="text-white/25 text-xs mt-1">Starting soon</div>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <div className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Latest Report</div>
              <div className="text-3xl font-bold text-blue-400">
                {latestReport ? `Month ${latestReport.fields.month}` : "Coming soon"}
              </div>
              {latestReport?.fields.sent_at && (
                <div className="text-white/25 text-xs mt-1">
                  {new Date(latestReport.fields.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              )}
            </GlassCard>
          </div>

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

          {/* All caught up (only when no pending AND no reports) */}
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

      {/* ─── Paused / Failed ─── */}
      {!isOnboarding && !isActive && (
        <GlassCard className="p-8 text-center">
          <div className="text-sm text-white/40">
            Your program is currently paused. Contact your account manager for details.
          </div>
        </GlassCard>
      )}
    </div>
  );
}
