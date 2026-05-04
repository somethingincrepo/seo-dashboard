"use client";

import { useState } from "react";
import Link from "next/link";
import type { AuditRunSummary, AuditIssue, SchemaCoverage } from "@/lib/audit/queries";
import { buildHealthChecks, type HealthCheck, type HealthStatus } from "@/lib/audit/health-checks";

interface Props {
  token: string;
  run: AuditRunSummary;
  issues: AuditIssue[];
  schemaCoverage: SchemaCoverage[];
}

const GROUP_ORDER: HealthCheck["group"][] = [
  "Security",
  "Discoverability",
  "AI readiness",
  "Indexability",
  "Structure",
];

type SectionKey = HealthCheck["group"] | "Schema" | "All";

export function SiteHealthBoard({ token, run, issues, schemaCoverage }: Props) {
  const checks = buildHealthChecks(run, issues);
  const [active, setActive] = useState<SectionKey>("All");

  const passCount = checks.filter((c) => c.status === "ok").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  const grouped = new Map<HealthCheck["group"], HealthCheck[]>();
  for (const c of checks) {
    if (!grouped.has(c.group)) grouped.set(c.group, []);
    grouped.get(c.group)!.push(c);
  }

  const navItems: { key: SectionKey; label: string; count: number; failCount: number }[] = [
    { key: "All", label: "All checks", count: checks.length, failCount: failCount + warnCount },
    ...GROUP_ORDER.map((g) => {
      const rows = grouped.get(g) ?? [];
      return {
        key: g as SectionKey,
        label: g,
        count: rows.length,
        failCount: rows.filter((r) => r.status === "fail" || r.status === "warn").length,
      };
    }),
    {
      key: "Schema" as SectionKey,
      label: "Schema",
      count: schemaCoverage.length,
      failCount: schemaCoverage.filter((s) => s.pages_with === 0 && IMPORTANT_SCHEMA.includes(s.schema_type)).length,
    },
  ];

  return (
    <div className="grid grid-cols-12 gap-5">
      <aside className="col-span-3 lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3 h-fit sticky top-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-2 mb-1">Sections</div>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                  isActive ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-left truncate">{item.label}</span>
                {item.failCount > 0 ? (
                  <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/60">
                    {item.failCount}
                  </span>
                ) : (
                  <span className={`tabular-nums text-[11px] ${isActive ? "text-slate-500" : "text-slate-400"}`}>{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="col-span-9 lg:col-span-10 space-y-5">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-5 py-4 flex items-center gap-5">
          <SummaryDial pass={passCount} total={checks.length} />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-700">
              {failCount === 0 && warnCount === 0
                ? "All foundational signals look good."
                : `${failCount + warnCount} signal${(failCount + warnCount) === 1 ? "" : "s"} need${(failCount + warnCount) === 1 ? "s" : ""} attention.`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Crawl from {new Date(run.crawl_completed_at ?? run.created_at).toLocaleString()}.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Tally label="Healthy" value={passCount} tone="emerald" />
            <Tally label="Warnings" value={warnCount} tone="amber" />
            <Tally label="Failing" value={failCount} tone="rose" />
          </div>
        </div>

        {(active === "All" || GROUP_ORDER.includes(active as HealthCheck["group"])) && (
          <div className="space-y-5">
            {GROUP_ORDER.map((group) => {
              if (active !== "All" && active !== group) return null;
              const rows = grouped.get(group);
              if (!rows || rows.length === 0) return null;
              return <ChecksSection key={group} group={group} rows={rows} token={token} />;
            })}
          </div>
        )}
        {(active === "Schema" || active === "All") && (
          <SchemaSection schemaCoverage={schemaCoverage} />
        )}
      </div>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────

function ChecksSection({ group, rows, token }: { group: HealthCheck["group"]; rows: HealthCheck[]; token: string }) {
  const passed = rows.filter((r) => r.status === "ok").length;
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">{group}</span>
        <span className="text-[11px] text-slate-400 tabular-nums">({passed}/{rows.length})</span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <CheckRow key={row.id} token={token} row={row} />
        ))}
      </div>
    </div>
  );
}

function CheckRow({ token, row }: { token: string; row: HealthCheck }) {
  const ui = STATUS_UI[row.status];
  const inner = (
    <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
      <div className="mt-0.5 shrink-0">{ui.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[14px] font-medium ${ui.labelClass}`}>{row.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ring-1 ring-inset ${ui.pillClass}`}>{ui.pillText}</span>
        </div>
        <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{row.why}</p>
        {row.detail && (
          <p className={`text-[12px] mt-1.5 ${row.status === "fail" ? "text-rose-600" : row.status === "warn" ? "text-amber-700" : "text-slate-500"}`}>
            {row.detail}
          </p>
        )}
      </div>
      {row.rule_id && (row.status === "fail" || row.status === "warn") && (
        <div className="text-[11px] text-indigo-600 hover:underline whitespace-nowrap shrink-0 self-center">
          View affected pages →
        </div>
      )}
    </div>
  );
  if (row.rule_id && (row.status === "fail" || row.status === "warn")) {
    return (
      <Link href={`/portal/${token}/audit?rule=${row.rule_id}`} className="block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

// ─── Schema panel ──────────────────────────────────────────────────────

const IMPORTANT_SCHEMA = ["Organization", "WebSite", "Article", "BlogPosting", "Product", "FAQPage", "BreadcrumbList"];

const SCHEMA_INFO: Record<string, { label: string; why: string; icon: React.ReactNode }> = {
  Organization: {
    label: "Organization",
    why: "Your brand identity for search engines and AI assistants. Belongs on the homepage.",
    icon: <SchemaIcon path="M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4" />,
  },
  WebSite: {
    label: "WebSite + Search",
    why: "Powers the sitelinks search box in Google and tells AI assistants where users can search.",
    icon: <SchemaIcon path="M11 21a8 8 0 1 1 5.656-13.657M21 21l-4.35-4.35" />,
  },
  Article: {
    label: "Article",
    why: "Marks long-form content for top stories, AI overview citations, and rich SERP cards.",
    icon: <SchemaIcon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />,
  },
  BlogPosting: {
    label: "BlogPosting",
    why: "Subtype of Article specifically for blog content. Same rich-result eligibility.",
    icon: <SchemaIcon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />,
  },
  Product: {
    label: "Product",
    why: "Required for product cards in SERPs, price/availability rich results, and AI shopping comparisons.",
    icon: <SchemaIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 21V12 M15 21V12" />,
  },
  LocalBusiness: {
    label: "LocalBusiness",
    why: "Unlocks Google Business Profile linking, map pack visibility, and AI geographic queries.",
    icon: <SchemaIcon path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  },
  FAQPage: {
    label: "FAQPage",
    why: "Wraps Q&A content for FAQ rich results and direct AI assistant extraction.",
    icon: <SchemaIcon path="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  },
  HowTo: {
    label: "HowTo",
    why: "Marks step-by-step procedures for HowTo rich results and verbatim AI extraction.",
    icon: <SchemaIcon path="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  },
  Person: {
    label: "Person (Author)",
    why: "Author entity declaration. Critical for E-E-A-T signals on articles.",
    icon: <SchemaIcon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />,
  },
  BreadcrumbList: {
    label: "Breadcrumb",
    why: "Replaces the URL in SERPs with a readable breadcrumb path. Improves CTR on deep pages.",
    icon: <SchemaIcon path="M3 12h18 M9 6l6 6-6 6" />,
  },
  Review: {
    label: "Review",
    why: "Individual reviews. Combined with AggregateRating, drives star ratings in SERPs.",
    icon: <SchemaIcon path="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
  },
  AggregateRating: {
    label: "AggregateRating",
    why: "Aggregated review score. Required for star ratings in shopping and review SERP cards.",
    icon: <SchemaIcon path="M12 2v6 M8 2v6 M16 2v6 M3 8h18 M3 8v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" />,
  },
};

function SchemaSection({ schemaCoverage }: { schemaCoverage: SchemaCoverage[] }) {
  const known = schemaCoverage.filter((s) => SCHEMA_INFO[s.schema_type]);
  const other = schemaCoverage.filter((s) => !SCHEMA_INFO[s.schema_type] && s.pages_with > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">Schema</span>
        <span className="text-[11px] text-slate-400">Structured data coverage across your indexable pages</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
        {known.map((s) => (
          <SchemaCard key={s.schema_type} coverage={s} />
        ))}
      </div>
      {other.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Other schema detected</div>
          <div className="flex flex-wrap gap-2">
            {other.map((s) => (
              <span
                key={s.schema_type}
                className="text-[11px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-inset ring-slate-200/70"
              >
                {s.schema_type} <span className="text-slate-400 tabular-nums">({s.pages_with})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SchemaCard({ coverage }: { coverage: SchemaCoverage }) {
  const info = SCHEMA_INFO[coverage.schema_type]!;
  const present = coverage.pages_with > 0;
  const pct = coverage.total_pages > 0 ? Math.round((coverage.pages_with / coverage.total_pages) * 100) : 0;
  const isHomeOnly = ["Organization", "WebSite", "LocalBusiness"].includes(coverage.schema_type);
  const presenceLabel = present
    ? isHomeOnly && coverage.pages_with === 1
      ? "Present"
      : `${coverage.pages_with} ${coverage.pages_with === 1 ? "page" : "pages"} (${pct}%)`
    : "Missing";
  const presencePill = present
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
    : "bg-slate-50 text-slate-500 ring-slate-200";

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-white">
      <div className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${present ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
        {info.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium text-slate-800">{info.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ring-1 ring-inset ${presencePill}`}>{presenceLabel}</span>
        </div>
        <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">{info.why}</p>
      </div>
    </div>
  );
}

function SchemaIcon({ path }: { path: string }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

// ─── Atoms ─────────────────────────────────────────────────────────────

const STATUS_UI: Record<HealthStatus, { icon: React.ReactNode; pillText: string; pillClass: string; labelClass: string }> = {
  ok: {
    icon: <Dot color="bg-emerald-500" ring="ring-emerald-200/70" check />,
    pillText: "Healthy",
    pillClass: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    labelClass: "text-slate-800",
  },
  fail: {
    icon: <Dot color="bg-rose-500" ring="ring-rose-200/70" cross />,
    pillText: "Needs fix",
    pillClass: "bg-rose-50 text-rose-700 ring-rose-200/70",
    labelClass: "text-slate-900",
  },
  warn: {
    icon: <Dot color="bg-amber-400" ring="ring-amber-200/70" exclaim />,
    pillText: "Warning",
    pillClass: "bg-amber-50 text-amber-700 ring-amber-200/70",
    labelClass: "text-slate-900",
  },
  unknown: {
    icon: <Dot color="bg-slate-300" ring="ring-slate-200" dash />,
    pillText: "Unknown",
    pillClass: "bg-slate-50 text-slate-500 ring-slate-200",
    labelClass: "text-slate-500",
  },
};

function Dot({ color, ring, check, cross, exclaim, dash }: { color: string; ring: string; check?: boolean; cross?: boolean; exclaim?: boolean; dash?: boolean }) {
  return (
    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center ring-2 ring-inset ${ring} bg-white`}>
      <span className={`w-3.5 h-3.5 rounded-full ${color} flex items-center justify-center`}>
        {check && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {cross && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        {exclaim && <span className="text-white text-[10px] font-bold leading-none">!</span>}
        {dash && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="12" x2="18" y2="12" />
          </svg>
        )}
      </span>
    </span>
  );
}

function SummaryDial({ pass, total }: { pass: number; total: number }) {
  const pct = total > 0 ? pass / total : 0;
  const ring = `conic-gradient(rgb(16 185 129) ${(pct * 360).toFixed(0)}deg, rgb(226 232 240) 0deg)`;
  return (
    <div className="relative w-14 h-14 rounded-full" style={{ background: ring }}>
      <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
        <span className="text-[14px] font-semibold text-slate-700 tabular-nums">{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" }) {
  const cls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-rose-600";
  return (
    <div className="text-center">
      <div className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  );
}
