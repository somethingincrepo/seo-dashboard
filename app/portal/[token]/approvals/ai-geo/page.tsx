import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { ApprovalMasterDetail } from "@/components/portal/ApprovalMasterDetail";

export const revalidate = 0;

export default async function AIGEOApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;
  const recordId = client.id;

  const [pending, allChanges] = await Promise.all([
    getPendingApprovals(clientId, recordId),
    getClientChanges(clientId, recordId),
  ]);

  const decided = allChanges.filter(
    (c) => c.fields.approval !== "pending" && c.fields.approval_status !== "pending"
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI-GEO</h1>
        <p className="text-base text-slate-500 mt-1">AI visibility, GEO optimizations, and citation improvements.</p>
      </div>
      <ApprovalMasterDetail
        changes={pending}
        decidedChanges={decided}
        token={token}
        contactEmail={client.fields.contact_email}
        categoryFilter="AI-GEO"
      />
    </div>
  );
}
