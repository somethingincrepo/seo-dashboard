import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { PortalShell } from "@/components/portal/PortalShell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const pending = await getPendingApprovals(client.id);

  return (
    <PortalShell
      companyName={client.fields.company_name || "Your Portal"}
      token={token}
      pendingCount={pending.length}
    >
      {children}
    </PortalShell>
  );
}
