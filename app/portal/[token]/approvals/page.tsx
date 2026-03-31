import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { ApprovalMasterDetail } from "@/components/portal/ApprovalMasterDetail";

export const revalidate = 0;

export default async function ApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientId = client.fields.client_id || client.id;

  const [pending, allChanges] = await Promise.all([
    getPendingApprovals(clientId),
    getClientChanges(clientId),
  ]);

  const decided = allChanges.filter(
    (c) => c.fields.approval !== "pending" && c.fields.approval_status !== "pending"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white/90">Approvals</h1>
        <p className="text-white/40 text-sm mt-1">Review and approve your SEO recommendations</p>
      </div>
      <ApprovalMasterDetail
        changes={pending}
        decidedChanges={decided}
        token={token}
        contactEmail={client.fields.contact_email}
      />
    </div>
  );
}
