import Link from "next/link";
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
    articles_standard: articlesPublished, // all published articles (standard + longform combined for now)
    articles_longform: 0,                 // tracked separately once content base has article type field
    faq_sections: typeCount["FAQ"] ?? 0,
    content_refreshes: typeCount["Content Refresh"] ?? typeCount["Refresh"] ?? 0,
    pages_optimized: implementedPageUrls.size,
    internal_links: typeCount["Internal Link"] ?? typeCount["Internal Links"] ?? 0,
    reddit_comments: typeCount["Reddit"] ?? typeCount["Reddit Comment"] ?? 0,
  };
}

// ─── sidebar compact variant ─────────────────────────────────────────────────

function SidebarProgressRow({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = target === 0 ? 100 : Math.min(100, Math.round((actual / target) * 100));
  const done = actual >= target;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className={`text-[11px] tabular-nums ${done ? "text-emerald-600 font-medium" : "text-slate-400"}`}>{actual}/{target}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? "bg-emerald-400" : "bg-indigo-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3 mb-1.5 first:mt-0">
      {children}
    </div>
  );
}

export async function MonthlyProgressSidebar({ client }: { client: Client }) {
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

  const pkgBadge: Record<PackageTier, string> = {
    starter: "bg-slate-100 text-slate-600",
    growth: "bg-indigo-50 text-indigo-700",
    authority: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="px-3 py-3 border-t border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-slate-700">This Month</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400">Month {monthNumber}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pkgBadge[pkg]}`}>
            {PACKAGE_LABELS[pkg]}
          </span>
        </div>
      </div>

      {/* Content */}
      <SidebarSectionLabel>Content</SidebarSectionLabel>
      <div className="space-y-2">
        <SidebarProgressRow label="Standard articles" actual={actuals.articles_standard} target={targets.articles_standard} />
        {targets.articles_longform > 0 && (
          <SidebarProgressRow label="Long-form articles" actual={actuals.articles_longform} target={targets.articles_longform} />
        )}
        <SidebarProgressRow label="FAQ sections" actual={actuals.faq_sections} target={targets.faq_sections} />
        <SidebarProgressRow label="Content refreshes" actual={actuals.content_refreshes} target={targets.content_refreshes} />
      </div>

      {/* On-Page */}
      <SidebarSectionLabel>On-Page</SidebarSectionLabel>
      <div className="space-y-2">
        {targets.pages_optimized > 0 ? (
          <SidebarProgressRow label="Pages optimized" actual={actuals.pages_optimized} target={targets.pages_optimized} />
        ) : (
          <p className="text-[11px] text-slate-400 italic">Refresh rotation</p>
        )}
        <SidebarProgressRow label="Internal links" actual={actuals.internal_links} target={targets.internal_links} />
      </div>

      {/* Outreach */}
      <SidebarSectionLabel>Outreach</SidebarSectionLabel>
      <div className="space-y-2">
        <SidebarProgressRow label="Reddit comments" actual={actuals.reddit_comments} target={targets.reddit_comments} />
      </div>

      {/* Deliverables link */}
      <div className="mt-3">
        <Link
          href={`/portal/${client.fields.portal_token}/deliverables`}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all text-[11px] font-medium text-slate-500 hover:text-slate-700 group"
        >
          <span>What&rsquo;s included in your plan</span>
          <svg className="w-3 h-3 shrink-0 text-slate-400 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>
    </div>
  );
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
              label="Standard articles"
              actual={actuals.articles_standard}
              target={targets.articles_standard}
            />
            {targets.articles_longform > 0 && (
              <ProgressRow
                label="Long-form articles"
                actual={actuals.articles_longform}
                target={targets.articles_longform}
              />
            )}
            <ProgressRow
              label="FAQ sections"
              actual={actuals.faq_sections}
              target={targets.faq_sections}
            />
            <ProgressRow
              label="Content refreshes"
              actual={actuals.content_refreshes}
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
            <ProgressRow
              label="Reddit comments"
              actual={actuals.reddit_comments}
              target={targets.reddit_comments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
