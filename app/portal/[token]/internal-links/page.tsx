import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getClientChanges } from "@/lib/changes";
import { PACKAGES } from "@/lib/packages";
import type { PackageTier } from "@/lib/packages";
import { InternalLinksView } from "@/components/portal/InternalLinksView";
import { getSupabase } from "@/lib/supabase";

export const revalidate = 0;

function startOfMonthStr(): string {
 const now = new Date();
 const y = now.getFullYear();
 const m = String(now.getMonth() + 1).padStart(2, "0");
 return `${y}-${m}-01`;
}

export default async function InternalLinksPage({
 params,
}: {
 params: Promise<{ token: string }>;
}) {
 const { token } = await params;
 const client = await getClientByToken(token);
 if (!client) notFound();

 const clientId = client.fields.client_id || client.id;
 const recordId = client.id;

 const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
 const monthlyTarget = PACKAGES[pkg].internal_links;
 const monthStart = startOfMonthStr();

 const allChanges = await getClientChanges(clientId, recordId);

 // Filter to Internal Link type only
 const internalLinkChanges = allChanges.filter(
 (c) => (c.fields.type ?? "").toLowerCase() === "internal link"
 );

 const pending = internalLinkChanges.filter(
 (c) => (c.fields.approval ?? "") === "pending"
 );

 const decided = internalLinkChanges.filter(
 (c) => c.fields.approval !== "pending" && c.fields.approval !== undefined && c.fields.approval !== ""
 );

 // Count implemented this month
 const implementedCount = internalLinkChanges.filter((c) => {
 if (c.fields.execution_status !== "complete") return false;
 const implementedAt = c.fields.implemented_at;
 return implementedAt && implementedAt >= monthStart;
 }).length;

 // Pull internal_links_summary from the most recent completed audit run so
 // the empty state can explain WHY there are no proposals (healthy site vs.
 // pipeline error vs. audit hasn't run). Best-effort — column may not exist
 // yet on older Supabase deployments.
 let auditSummary: {
 status: string;
 message: string;
 issues_seen: number;
 pages_considered: number;
 } | null = null;
 try {
 const supabase = getSupabase();
 const { data } = await supabase
 .from("audit_runs")
 .select("internal_links_summary")
 .eq("client_id", clientId)
 .eq("status", "complete")
 .order("diagnose_completed_at", { ascending: false })
 .limit(1);
 const summary = (data?.[0]?.internal_links_summary ?? null) as typeof auditSummary;
 if (summary && typeof summary === "object" && "status" in summary) {
 auditSummary = summary;
 }
 } catch {
 // best-effort: column may be missing pre-migration
 }

 return (
 <InternalLinksView
 pending={pending}
 decided={decided}
 pkg={pkg}
 monthlyTarget={monthlyTarget}
 implementedCount={implementedCount}
 token={token}
 contactEmail={client.fields.contact_email}
 auditSummary={auditSummary}
 />
 );
}
