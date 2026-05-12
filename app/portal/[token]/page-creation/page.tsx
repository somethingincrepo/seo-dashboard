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
    <div className="-mx-10 -my-10 flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      <div className="px-10 pt-8 pb-5 shrink-0 border-b border-slate-100">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Page Creation</h1>
        <p className="text-[14px] text-slate-500 mt-0.5">
          New pages identified for your site — approve a suggestion to generate the full page content.
        </p>
      </div>
      <div className="flex-1 min-h-0 px-10 py-6 overflow-hidden">
        <PageCreationSuggestions
          items={items}
          historicalItems={historicalItems}
          token={token}
          clientPackage={clientPackage}
          companyName={client.fields.company_name || ""}
          cms={(client.fields.cms ?? "").toLowerCase()}
        />
      </div>
    </div>
  );
}
