import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getFaqSectionsForClient, getSupabase, type FaqSection } from "@/lib/supabase";
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

  const fetchFaqJob = async (): Promise<{ status: string; error: string | null; result: unknown } | null> => {
    try {
      const { data } = await getSupabase()
        .from("jobs")
        .select("status, error, result")
        .eq("client_id", client.id)
        .eq("sop_name", "generate_faq_sections")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { status: string; error: string | null; result: unknown } | null;
    } catch {
      return null;
    }
  };

  const [all, latestFaqJob] = await Promise.all([
    getFaqSectionsForClient(client.id).catch(() => [] as FaqSection[]),
    fetchFaqJob(),
  ]);

  const thisMonth = sortSections(all.filter((s: FaqSection) => s.proposed_at >= monthStart));
  const prevMonths = sortSections(all.filter((s: FaqSection) => s.proposed_at < monthStart));

  const items = thisMonth.filter((s) => s.status !== "skipped" && s.status !== "failed").slice(0, limit);
  const historicalItems = prevMonths.filter((s) => s.status !== "skipped" && s.status !== "failed");

  // Determine generation status so the empty state can distinguish between
  // "no job run yet", "ran but found no eligible pages", and "job failed".
  type GenState = { state: "pending" | "done_empty" | "failed"; message?: string } | undefined;
  let generationStatus: GenState;
  if (latestFaqJob) {
    if (latestFaqJob.status === "failed") {
      generationStatus = {
        state: "failed",
        message: (latestFaqJob.error as string | null) ?? undefined,
      };
    } else if (latestFaqJob.status === "done") {
      const result = latestFaqJob.result as Record<string, unknown> | null;
      const written = typeof result?.faq_sections_written === "number" ? result.faq_sections_written : null;
      if (written === 0) {
        generationStatus = { state: "done_empty" };
      }
    }
  }

  return (
    <FaqSectionsPanel
      items={items}
      historicalItems={historicalItems}
      token={token}
      limit={limit}
      clientPackage={clientPackage}
      generationStatus={generationStatus}
    />
  );
}
