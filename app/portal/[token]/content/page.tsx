import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { getContentResultsForClient } from "@/lib/content";
import { ArticleMasterDetail } from "@/components/portal/ArticleMasterDetail";
import { ApprovalMasterDetail } from "@/components/portal/ApprovalMasterDetail";

export const revalidate = 0;

export default async function ContentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const companyName = client.fields.company_name || "";

  const [articles, pending, allChanges] = await Promise.all([
    getContentResultsForClient(companyName),
    getPendingApprovals(clientId),
    getClientChanges(clientId),
  ]);

  const decided = allChanges.filter(
    (c) => c.fields.approval !== "pending" && c.fields.approval_status !== "pending"
  );

  const hasSeoContent =
    pending.some((c) => (c.fields.cat || c.fields.category) === "Content") ||
    decided.some((c) => (c.fields.cat || c.fields.category) === "Content");

  return (
    <div className="space-y-14">
      {/* Generated Articles */}
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Content</h1>
          <p className="text-base text-white/40 mt-1">
            Review AI-generated articles before they go live on your site.
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-8 py-12 text-center">
            <div className="text-2xl text-white/10 mb-3">✦</div>
            <p className="text-sm text-white/30">No articles ready for review yet.</p>
            <p className="text-xs text-white/20 mt-1">
              Articles will appear here once generation is complete.
            </p>
          </div>
        ) : (
          <ArticleMasterDetail results={articles} token={token} />
        )}
      </div>

      {/* SEO Content Changes (from audit) */}
      {hasSeoContent && (
        <div>
          <div className="mb-6 pb-4 border-t border-white/[0.06] pt-8">
            <h2 className="text-xl font-semibold text-white/70">SEO Content Recommendations</h2>
            <p className="text-sm text-white/30 mt-1">
              Content improvements identified during your site audit.
            </p>
          </div>
          <ApprovalMasterDetail
            changes={pending}
            decidedChanges={decided}
            token={token}
            contactEmail={client.fields.contact_email}
            categoryFilter="Content"
          />
        </div>
      )}
    </div>
  );
}
