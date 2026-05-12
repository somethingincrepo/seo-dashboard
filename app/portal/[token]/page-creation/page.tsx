import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getPageCreationSuggestionsForClient, type PageCreationSuggestion } from "@/lib/supabase";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { PageCreationSuggestions } from "@/components/portal/PageCreationSuggestions";

export const dynamic = "force-dynamic";

export default async function PageCreationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientPackage = (client.fields.package ?? "starter") as PackageTier;
  const limit = PACKAGES[clientPackage in PACKAGES ? clientPackage : "starter"].page_creation_suggestions;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const all = await getPageCreationSuggestionsForClient(client.id).catch(() => [] as PageCreationSuggestion[]);

  const rank = (s: PageCreationSuggestion) => {
    if (s.status === "content_ready") return 0;
    if (s.status === "suggested") return 1;
    if (s.status === "generating") return 2;
    if (s.status === "approved_for_publish" || s.status === "published") return 3;
    return 4;
  };
  const sorted = [...all].sort((a, b) => rank(a) - rank(b));

  const thisMonth = sorted.filter((s) => s.proposed_at >= monthStart);
  const prevMonths = sorted.filter((s) => s.proposed_at < monthStart);

  const items = thisMonth
    .filter((s) => s.status !== "skipped" && s.status !== "failed")
    .slice(0, limit);

  const historicalItems = prevMonths.filter(
    (s) => s.status !== "skipped" && s.status !== "failed"
  );

  return (
    <div className="-mx-10 flex flex-col min-h-[calc(100vh-5rem)]">
      <div className="px-10 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Page Creation
        </h1>
        <p className="text-base text-slate-500 mt-1">
          Each month we identify gaps in your site&apos;s coverage and suggest new pages to build — industry verticals, service areas, use cases, and more. Approve a suggestion to kick off full content generation.
        </p>
      </div>

      <PageCreationSuggestions
        items={items}
        historicalItems={historicalItems}
        token={token}
        clientPackage={clientPackage}
        companyName={client.fields.company_name || ""}
      />
    </div>
  );
}
