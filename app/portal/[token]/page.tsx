import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChangeCard } from "@/components/ui/ChangeCard";
import Link from "next/link";

export const revalidate = 0; // Always fresh for client portal

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);

  if (!client) notFound();

  const pendingChanges = await getPendingApprovals(client.id);

  // Group by page
  const byPage: Record<string, typeof pendingChanges> = {};
  pendingChanges.forEach((c) => {
    const page = c.fields.page_url || "Site-wide";
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(c);
  });

  const tier1 = pendingChanges.filter((c) => c.fields.implementation_tier === "tier_1");
  const tier2 = pendingChanges.filter((c) => c.fields.implementation_tier !== "tier_1");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{client.fields.company_name}</div>
          <div className="text-white/35 text-xs">SEO Approval Portal</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs">{pendingChanges.length} pending</span>
          <Link
            href={`/portal/${token}/reports`}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Reports →
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Intro */}
        <div>
          <h1 className="text-2xl font-semibold">Your SEO Approvals</h1>
          <p className="text-white/40 text-sm mt-2 leading-relaxed">
            Review the recommendations below. Approve changes you&apos;re comfortable with, skip
            ones you&apos;d like to hold off on, or ask a question if you need clarification.
            Approved changes are implemented within 24 hours.
          </p>
        </div>

        {pendingChanges.length === 0 && (
          <GlassCard className="p-12 text-center">
            <div className="text-4xl mb-4">✦</div>
            <div className="font-medium mb-1">All caught up!</div>
            <div className="text-white/40 text-sm">No pending approvals right now. We&apos;ll notify you when new recommendations are ready.</div>
          </GlassCard>
        )}

        {/* Tier 1 changes */}
        {tier1.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white/70">Quick Wins</h2>
              <span className="text-xs text-white/30">{tier1.length} changes · no design impact</span>
            </div>
            {Object.entries(byPage)
              .filter(([, changes]) => changes.some((c) => c.fields.implementation_tier === "tier_1"))
              .map(([page, changes]) => (
                <PageGroup
                  key={page}
                  page={page}
                  changes={changes.filter((c) => c.fields.implementation_tier === "tier_1")}
                  token={token}
                />
              ))}
          </section>
        )}

        {/* Tier 2 changes */}
        {tier2.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white/70">Content & Structural</h2>
              <span className="text-xs text-white/30">{tier2.length} changes · may require design review</span>
            </div>
            {Object.entries(byPage)
              .filter(([, changes]) => changes.some((c) => c.fields.implementation_tier !== "tier_1"))
              .map(([page, changes]) => (
                <PageGroup
                  key={page}
                  page={page}
                  changes={changes.filter((c) => c.fields.implementation_tier !== "tier_1")}
                  token={token}
                />
              ))}
          </section>
        )}
      </div>
    </div>
  );
}

function PageGroup({
  page,
  changes,
  token,
}: {
  page: string;
  changes: Awaited<ReturnType<typeof getPendingApprovals>>;
  token: string;
}) {
  // Truncate URL for display
  let displayPage = page;
  try {
    const url = new URL(page);
    displayPage = url.pathname === "/" ? url.hostname : url.pathname;
  } catch {
    // not a URL
  }

  return (
    <div>
      <div className="text-xs text-white/30 font-mono mb-2 px-1">{displayPage}</div>
      <div className="space-y-3">
        {changes.map((change) => (
          <ChangeCard key={change.id} change={change} token={token} />
        ))}
      </div>
    </div>
  );
}
