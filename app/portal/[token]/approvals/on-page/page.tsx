import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals, getClientChanges } from "@/lib/changes";
import { ApprovalMasterDetail } from "@/components/portal/ApprovalMasterDetail";

export const revalidate = 0;

export default async function OnPageApprovalsPage({ params }: { params: Promise<{ token: string }> }) {
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
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white/90">On-Page</h1>
        <p className="text-base text-white/40 mt-1">Metadata, headings, and other on-page optimizations.</p>
      </div>
      <ApprovalMasterDetail
        changes={pending}
        decidedChanges={decided}
        token={token}
        contactEmail={client.fields.contact_email}
        categoryFilter="On-Page"
      />
    </div>
  );
}
