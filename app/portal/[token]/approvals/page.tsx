import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { GlassCard } from "@/components/ui/GlassCard";
import { BatchApproveButton } from "@/components/portal/BatchApproveButton";
import { CategorySection } from "@/components/portal/CategorySection";

export const revalidate = 0;

const CATEGORY_ORDER = ["Technical", "On-Page", "Content", "AI-GEO"];

export default async function ApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const pending = await getPendingApprovals(client.id);

  // Group by category
  const groups: Record<string, typeof pending> = {};
  for (const c of pending) {
    const cat = c.fields.cat || c.fields.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(c);
  }

  const tier1Ids = pending.filter((c) => c.fields.implementation_tier === "tier_1").map((c) => c.id);
  const tier1Count = tier1Ids.length;

  // Empty state
  if (pending.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white/90">Approvals</h1>
          <p className="text-white/40 text-sm mt-1">Review and approve your SEO recommendations</p>
        </div>
        <GlassCard className="p-14 text-center">
          <div className="text-3xl mb-4 text-white/20">✦</div>
          <div className="font-medium text-white/70 mb-2">All caught up!</div>
          <div className="text-sm text-white/40 max-w-sm mx-auto">
            No pending recommendations right now. We&apos;ll let you know when new ones are ready.
          </div>
        </GlassCard>
      </div>
    );
  }

  // Category breakdown string
  const breakdownParts = CATEGORY_ORDER
    .filter((cat) => groups[cat])
    .map((cat) => `${cat}: ${groups[cat].length}`)
    .join(" · ");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white/90">Approvals</h1>
        <p className="text-white/40 text-sm mt-1">Review and approve your SEO recommendations</p>
      </div>

      {/* Overview bar */}
      <GlassCard className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-white/60">
            <span className="text-white/90 font-semibold">{pending.length}</span> pending
          </span>
          <span className="text-white/15">|</span>
          <span className="text-xs text-white/40">{breakdownParts}</span>
          {tier1Count > 0 && (
            <>
              <span className="text-white/15">|</span>
              <span className="text-xs text-emerald-400/60">{tier1Count} quick wins</span>
            </>
          )}
        </div>
        {tier1Count > 0 && (
          <BatchApproveButton recordIds={tier1Ids} token={token} />
        )}
      </GlassCard>

      {/* Category sections */}
      <div className="space-y-10">
        {CATEGORY_ORDER.filter((cat) => groups[cat]).map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            changes={groups[cat]}
            token={token}
          />
        ))}

        {/* Any categories not in the standard order */}
        {Object.entries(groups)
          .filter(([cat]) => !CATEGORY_ORDER.includes(cat))
          .map(([cat, changes]) => (
            <CategorySection
              key={cat}
              category={cat}
              changes={changes}
              token={token}
            />
          ))}
      </div>
    </div>
  );
}
