import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { GlassCard } from "@/components/ui/GlassCard";
import { CategorySection } from "@/components/portal/CategorySection";

export const revalidate = 0;

export default async function OnPageApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;

  const pending = await getPendingApprovals(clientId);
  const changes = pending.filter((c) => (c.fields.cat || c.fields.category) === "On-Page");

  if (changes.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white/90">On-Page</h1>
          <p className="text-white/40 text-sm mt-1">Metadata, headings, and other on-page optimizations.</p>
        </div>
        <GlassCard className="p-12 text-center">
          <div className="text-3xl mb-4 text-white/20">✦</div>
          <div className="font-medium text-white/70 mb-1">No on-page changes pending</div>
          <div className="text-sm text-white/40">All caught up in this category.</div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white/90">On-Page</h1>
        <p className="text-white/40 text-sm mt-1">Metadata, headings, and other on-page optimizations.</p>
      </div>
      <CategorySection category="On-Page" changes={changes} token={token} />
    </div>
  );
}
