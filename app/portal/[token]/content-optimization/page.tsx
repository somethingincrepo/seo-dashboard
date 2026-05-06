import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getContentRefreshesForClient, type ContentRefresh } from "@/lib/supabase";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { ContentOptimization } from "@/components/portal/ContentOptimization";

export const dynamic = "force-dynamic";

export default async function ContentOptimizationPage({
 params,
}: {
 params: Promise<{ token: string }>;
}) {
 const { token } = await params;
 const client = await getClientByToken(token);
 if (!client) notFound();

 const clientPackage = (client.fields.package ?? "starter") as PackageTier;
 const limit = PACKAGES[clientPackage in PACKAGES ? clientPackage : "starter"].content_refreshes;

 // First day of current month (UTC)
 const now = new Date();
 const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

 const all = await getContentRefreshesForClient(client.id).catch(() => [] as ContentRefresh[]);

 // Sort within a bucket: ready-for-review → in-progress → completed/approved → failed
 const rank = (r: ContentRefresh) => {
 if (r.status === "completed" && !r.portal_approval) return 0;
 if (r.status === "in_progress" || r.status === "approved") return 1;
 if (r.status === "failed") return 3;
 return 2;
 };
 const sorted = [...all].sort((a, b) => rank(a) - rank(b));

 const thisMonth = sorted.filter((r) => r.proposed_at >= monthStart);
 const prevMonths = sorted.filter((r) => r.proposed_at < monthStart);

 // Current month: only show refreshes the SOP has produced output for
 const items = thisMonth
 .filter((r) => r.status === "completed" || r.status === "approved_for_publish" || r.status === "published")
 .slice(0, limit);

 // Historical: anything that produced a result, newest first
 const historicalItems = prevMonths.filter(
 (r) => r.status === "completed" || r.status === "approved_for_publish" || r.status === "published"
 );

 return (
 <div className="-mx-10 flex flex-col min-h-[calc(100vh-5rem)]">
 <div className="px-10 mb-6">
 <h1 className="text-3xl font-bold tracking-tight text-slate-900">
 Content Refreshes
 </h1>
 <p className="text-base text-slate-500 mt-1">
 Each month we update existing pages and blog posts to improve keyword coverage, strengthen headings, and sharpen body copy
 </p>
 </div>

 <ContentOptimization
 items={items}
 historicalItems={historicalItems}
 token={token}
 clientPackage={clientPackage}
 />
 </div>
 );
}
