import { airtableFetch, contentAirtableFetch } from "@/lib/airtable";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import type { Client } from "@/lib/clients";

// ─── helpers ─────────────────────────────────────────────────────────────────

function startOfMonthStr(): string {
  const now = new Date();
  // Format as YYYY-MM-DD for Airtable IS_AFTER
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ProgressRow({
  label,
  actual,
  target,
}: {
  label: string;
  actual: number;
  target: number;
}) {
  const pct = target === 0 ? 100 : Math.min(100, Math.round((actual / target) * 100));
  const done = actual >= target;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-slate-500 w-44 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] tabular-nums text-slate-400 w-14 text-right shrink-0">
        {actual} / {target}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
      {children}
    </div>
  );
}

// ─── data fetching ────────────────────────────────────────────────────────────

type ChangeRecord = {
  id: string;
  fields: {
    type?: string;
    execution_status?: string;
    implemented_at?: string;
    page_url?: string;
    client_id?: string;
  };
};

type ContentJobRecord = {
  id: string;
  fields: {
    Status?: string;
    title_status?: string;
    "Client ID"?: string[];
    proposed_at?: string;
  };
};

type ContentClientRecord = {
  id: string;
  fields: { "Client Name"?: string };
};

async function fetchActuals(
  clientRecordId: string,
  clientSlug: string,
  companyName: string,
  monthStart: string
) {
  const clientFilter = `OR(FIND("${clientRecordId}",{client_id}),FIND("${clientSlug}",{client_id}))`;

  // Fetch implemented changes this month
  let changes: ChangeRecord[] = [];
  try {
    changes = await airtableFetch<ChangeRecord>("Changes", {
      filterByFormula: `AND(${clientFilter},{execution_status}="complete",IS_AFTER({implemented_at},"${monthStart}"))`,
    });
  } catch {
    // non-fatal — show zeros
  }

  // Count by type
  const typeCount: Record<string, number> = {};
  const implementedPageUrls = new Set<string>();
  for (const c of changes) {
    const type = c.fields.type ?? "";
    typeCount[type] = (typeCount[type] ?? 0) + 1;
    if (c.fields.page_url) implementedPageUrls.add(c.fields.page_url);
  }

  // Fetch published articles from content base
  let articlesPublished = 0;
  try {
    const contentClients = await contentAirtableFetch<ContentClientRecord>(
      "Clients",
      { filterByFormula: `{Client Name}="${companyName}"` }
    );
    if (contentClients.length > 0) {
      const contentClientId = contentClients[0].id;
      const jobs = await contentAirtableFetch<ContentJobRecord>(
        "Content Jobs",
        {
          filterByFormula: `AND(FIND("${contentClientId}",ARRAYJOIN({Client ID},",")),{Status}="Completed")`,
        }
      );
      // Filter to current month by proposed_at (best proxy we have)
      articlesPublished = jobs.filter((j) => {
        const d = j.fields.proposed_at;
        return d && d >= monthStart;
      }).length;
    }
  } catch {
    // non-fatal
  }

  return {
    articles: articlesPublished,
    faq_sections: typeCount["FAQ"] ?? 0,
    pages_optimized: implementedPageUrls.size,
    internal_links: typeCount["Internal Link"] ?? 0,
  };
}

// ─── main component ───────────────────────────────────────────────────────────

export async function MonthlyProgress({ client }: { client: Client }) {
  const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
  const targets = PACKAGES[pkg];
  const monthNumber = client.fields.month_number ?? 1;
  const monthStart = startOfMonthStr();

  const actuals = await fetchActuals(
    client.id,
    client.fields.client_id,
    client.fields.company_name,
    monthStart
  );

  const packageColors: Record<PackageTier, string> = {
    starter: "bg-slate-100 text-slate-600",
    growth: "bg-indigo-50 text-indigo-700",
    authority: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-800">This Month</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Month {monthNumber}</span>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${packageColors[pkg]}`}
          >
            {PACKAGE_LABELS[pkg]}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Content */}
        <div>
          <SectionLabel>Content</SectionLabel>
          <div className="space-y-2.5">
            <ProgressRow
              label="Articles published"
              actual={actuals.articles}
              target={targets.articles_standard + targets.articles_longform}
            />
            <ProgressRow
              label="FAQ sections"
              actual={actuals.faq_sections}
              target={targets.faq_sections}
            />
            <ProgressRow
              label="Content refreshes"
              actual={0}
              target={targets.content_refreshes}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* On-Page */}
        <div>
          <SectionLabel>On-Page</SectionLabel>
          <div className="space-y-2.5">
            {targets.pages_optimized > 0 ? (
              <ProgressRow
                label="Pages optimized"
                actual={actuals.pages_optimized}
                target={targets.pages_optimized}
              />
            ) : (
              <div className="text-[12px] text-slate-400 italic">
                Page optimization — refresh rotation
              </div>
            )}
            <ProgressRow
              label="Internal links added"
              actual={actuals.internal_links}
              target={targets.internal_links}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
