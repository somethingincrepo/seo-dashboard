import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getFaqSectionsForClient, type FaqSection } from "@/lib/supabase";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { FaqSectionsPanel } from "@/components/portal/FaqSectionsPanel";

export const dynamic = "force-dynamic";

const PRIORITY_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const STATUS_RANK: Record<string, number> = {
  suggested: 0,
  approved: 1,
  skipped: 2,
  failed: 3,
};

function sortSections(sections: FaqSection[]): FaqSection[] {
  return [...sections].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? "Low"] ?? 3;
    const pb = PRIORITY_RANK[b.priority ?? "Low"] ?? 3;
    if (pa !== pb) return pa - pb;
    return (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
  });
}

export default async function FaqsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const clientPackage = (client.fields.package ?? "starter") as PackageTier;
  const limit = PACKAGES[clientPackage in PACKAGES ? clientPackage : "starter"].faq_sections;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const all = await getFaqSectionsForClient(client.id).catch(() => [] as FaqSection[]);

  const thisMonth = sortSections(all.filter((s) => s.proposed_at >= monthStart));
  const prevMonths = sortSections(all.filter((s) => s.proposed_at < monthStart));

  const items = thisMonth.filter((s) => s.status !== "skipped" && s.status !== "failed").slice(0, limit);
  const historicalItems = prevMonths.filter((s) => s.status !== "skipped" && s.status !== "failed");

  return (
    <div className="-mx-10 -my-10 flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      <div className="px-10 pt-8 pb-5 shrink-0 border-b border-slate-100">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">FAQ Sections</h1>
        <p className="text-[14px] text-slate-500 mt-0.5">
          AI-generated question &amp; answer sections for your priority pages — approve to implement.
        </p>
      </div>
      <div className="flex-1 min-h-0 px-10 py-6 overflow-hidden">
        <FaqSectionsPanel
          items={items}
          historicalItems={historicalItems}
          token={token}
          limit={limit}
          clientPackage={clientPackage}
        />
      </div>
    </div>
  );
}
