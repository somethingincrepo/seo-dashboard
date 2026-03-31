import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPendingApprovals } from "@/lib/changes";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const revalidate = 0;

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

  const clientId = client.fields.client_id || client.id;
  const pending = await getPendingApprovals(clientId);
  const status = client.fields.status || client.fields.plan_status || "form_submitted";

  // Build category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const c of pending) {
    const cat = c.fields.cat || c.fields.category || "Other";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  }

  return (
    <PortalSidebar
      companyName={client.fields.company_name || "Your Portal"}
      token={token}
      pendingCount={pending.length}
      categoryBreakdown={categoryBreakdown}
      monthNumber={client.fields.month_number || 0}
      clientStatus={status}
    >
      {children}
    </PortalSidebar>
  );
}
