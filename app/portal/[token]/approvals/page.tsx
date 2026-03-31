import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { GlassCard } from "@/components/ui/GlassCard";
import { BatchApproveButton } from "@/components/portal/BatchApproveButton";
import { ApprovalProgress } from "@/components/portal/ApprovalProgress";
import { CollapsiblePageGroup } from "@/components/portal/CollapsiblePageGroup";
import { ApprovalsProvider } from "./approvals-client";

export const revalidate = 0;

export default async function ApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const pending = await getPendingApprovals(client.id);

  // Split tier_1 (quick wins) vs tier_2+ (content/structural)
  const tier1 = pending.filter((c) => c.fields.implementation_tier === "tier_1");
  const tier2 = pending.filter((c) => c.fields.implementation_tier !== "tier_1");

  // Group each tier by page URL
  function groupByPage(changes: typeof pending): Record<string, typeof pending> {
    const groups: Record<string, typeof pending> = {};
    for (const c of changes) {
      const page = c.fields.page_url || "Site-wide";
      if (!groups[page]) groups[page] = [];
      groups[page].push(c);
    }
    return groups;
  }

  const tier1Groups = groupByPage(tier1);
  const tier2Groups = groupByPage(tier2);
  const tier1Ids = tier1.map((c) => c.id);

  // Empty state
  if (pending.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Approvals</h1>
          <p className="text-white/40 text-sm mt-1">Review and approve your SEO recommendations</p>
        </div>
        <GlassCard className="p-14 text-center">
          <div className="text-3xl mb-4 text-white/20">\u2726</div>
          <div className="font-medium text-white/70 mb-2">All caught up</div>
          <div className="text-sm text-white/40 max-w-sm mx-auto">
            No pending recommendations right now. We&apos;ll let you know when new ones are ready.
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <ApprovalsProvider total={pending.length}>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Approvals</h1>
            <p className="text-white/40 text-sm mt-1">Review and approve your SEO recommendations</p>
          </div>
          <ApprovalProgress total={pending.length} />
        </div>

        {/* Tier 1 — Quick Wins */}
        {tier1.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                  Quick Wins
                  <span className="ml-2 text-white/30 normal-case font-normal tracking-normal">
                    {tier1.length} change{tier1.length !== 1 ? "s" : ""} · no visual impact
                  </span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Safe, technical improvements — metadata, schema, alt text, headings. We can implement these immediately once approved.
                </p>
              </div>
              <BatchApproveButton recordIds={tier1Ids} token={token} />
            </div>

            <div className="space-y-3">
              {Object.entries(tier1Groups).map(([page, changes], i) => (
                <CollapsiblePageGroup
                  key={page}
                  page={page}
                  changes={changes}
                  token={token}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tier 2 — Content & Structural */}
        {tier2.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                Content & Structural
                <span className="ml-2 text-white/30 normal-case font-normal tracking-normal">
                  {tier2.length} change{tier2.length !== 1 ? "s" : ""} · may affect page layout or copy
                </span>
              </h2>
              <p className="text-xs text-white/40 mt-1">
                These involve rewriting content, adding new sections, or structural adjustments. Review each carefully before approving.
              </p>
            </div>

            <div className="space-y-3">
              {Object.entries(tier2Groups).map(([page, changes], i) => (
                <CollapsiblePageGroup
                  key={page}
                  page={page}
                  changes={changes}
                  token={token}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </ApprovalsProvider>
  );
}
