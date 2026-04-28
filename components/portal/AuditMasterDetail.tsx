"use client";

import { useMemo, useState, useCallback } from "react";
import type { AuditRunSummary, AuditIssue } from "@/lib/audit/queries";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type Severity = (typeof SEVERITIES)[number];

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  "on-page": "On-Page",
  content: "Content",
  "ai-geo": "AI-GEO",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-rose-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-emerald-400",
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-rose-50 text-rose-700 ring-rose-200/70",
  high: "bg-orange-50 text-orange-700 ring-orange-200/70",
  medium: "bg-amber-50 text-amber-700 ring-amber-200/70",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-rose-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-400",
  low: "border-l-emerald-400",
};

function pageLabel(url: string | null): string {
  if (!url) return "Sitewide";
  try {
    const u = new URL(url);
    if (u.pathname === "/" || u.pathname === "") return "Homepage";
    return u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

interface Props {
  run: AuditRunSummary;
  issues: AuditIssue[];
}

export function AuditMasterDetail({ run: _run, issues }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(issues[0]?.id ?? null);
  const [filterSeverity, setFilterSeverity] = useState<"all" | Severity>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | keyof typeof CATEGORY_LABEL>("all");
  const [collapsed, setCollapsed] = useState<Set<Severity>>(new Set());

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      return true;
    });
  }, [issues, filterSeverity, filterCategory]);

  const grouped = useMemo(() => {
    const m = new Map<Severity, AuditIssue[]>();
    for (const sev of SEVERITIES) m.set(sev, []);
    for (const i of filtered) m.get(i.severity as Severity)?.push(i);
    return m;
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of issues) c[i.severity as Severity] = (c[i.severity as Severity] ?? 0) + 1;
    return c;
  }, [issues]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of issues) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [issues]);

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

  const toggleCollapsed = useCallback((sev: Severity) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }, []);

  if (issues.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-slate-700 font-medium">No issues found</p>
        <p className="text-slate-500 text-sm mt-1.5 max-w-md mx-auto">
          We didn't find any deterministic issues on your site. That's exceptional — most sites have at least a handful.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200/80 shadow-sm p-1">
          <FilterChip
            label="All severities"
            count={issues.length}
            active={filterSeverity === "all"}
            onClick={() => setFilterSeverity("all")}
          />
          {SEVERITIES.map((sev) => (
            <FilterChip
              key={sev}
              label={cap(sev)}
              dot={SEVERITY_DOT[sev]}
              count={counts[sev] ?? 0}
              active={filterSeverity === sev}
              onClick={() => setFilterSeverity(sev)}
              dim={!counts[sev]}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200/80 shadow-sm p-1">
          <FilterChip
            label="All categories"
            count={issues.length}
            active={filterCategory === "all"}
            onClick={() => setFilterCategory("all")}
          />
          {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((cat) => (
            <FilterChip
              key={cat}
              label={CATEGORY_LABEL[cat]}
              count={categoryCounts[cat] ?? 0}
              active={filterCategory === cat}
              onClick={() => setFilterCategory(cat)}
              dim={!categoryCounts[cat]}
            />
          ))}
        </div>
      </div>

      {/* Master-detail */}
      <div className="flex gap-4 h-[calc(100vh-16rem)] min-h-[640px]">
        {/* Left list */}
        <div className="w-[42%] bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            {SEVERITIES.map((sev) => {
              const items = grouped.get(sev) ?? [];
              if (items.length === 0) return null;
              const isCollapsed = collapsed.has(sev);
              return (
                <div key={sev} className="border-b border-slate-100 last:border-b-0">
                  <button
                    onClick={() => toggleCollapsed(sev)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[sev]}`}/>
                    <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-700">
                      {cap(sev)}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">({items.length})</span>
                  </button>
                  {!isCollapsed && items.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      selected={selected?.id === issue.id}
                      onClick={() => setSelectedId(issue.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right detail */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          {selected ? <IssueDetail issue={selected} /> : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select an issue to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  dot,
  dim,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  dot?: string;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : dim
          ? "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      <span>{label}</span>
      {typeof count === "number" && (
        <span className={`text-[10px] tabular-nums ${active ? "text-slate-300" : "text-slate-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function IssueRow({
  issue,
  selected,
  onClick,
}: {
  issue: AuditIssue;
  selected: boolean;
  onClick: () => void;
}) {
  const sev = issue.severity as Severity;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 cursor-pointer transition-all duration-150 border-l-2 ${
        selected
          ? `${SEVERITY_BORDER[sev]} bg-slate-50/80`
          : "border-l-transparent hover:bg-slate-50 hover:border-l-slate-300"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[sev]}`}/>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-800 truncate">{issue.rule_name}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">
            {issue.scope === "site" ? "Sitewide" : truncate(pageLabel(issue.page_url), 60)}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70 font-mono">
              {issue.rule_id}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {CATEGORY_LABEL[issue.category] ?? issue.category}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function IssueDetail({ issue }: { issue: AuditIssue }) {
  const sev = issue.severity as Severity;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-6 max-w-3xl">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${SEVERITY_PILL[sev]} font-semibold uppercase tracking-wider`}>
              {sev}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70 font-mono">
              {issue.rule_id}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {CATEGORY_LABEL[issue.category] ?? issue.category}
            </span>
            {issue.scope === "site" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70">
                Sitewide
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 leading-tight">{issue.rule_name}</h2>
          {issue.page_url && (
            <a
              href={issue.page_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-indigo-600 hover:text-indigo-700 hover:underline underline-offset-2"
            >
              {issue.page_url}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>

        <DetailSection label="What we found">
          <pre className="font-mono text-[13px] text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 whitespace-pre-wrap break-words">
            {issue.current_value ?? "—"}
          </pre>
        </DetailSection>

        <DetailSection label="What's expected">
          <p className="text-[14px] text-slate-700 leading-relaxed">
            {issue.expected_value ?? "—"}
          </p>
        </DetailSection>

        {issue.evidence && Object.keys(issue.evidence).length > 0 && (
          <DetailSection label="Evidence">
            <pre className="font-mono text-[12px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 whitespace-pre-wrap break-words overflow-x-auto">
              {JSON.stringify(issue.evidence, null, 2)}
            </pre>
          </DetailSection>
        )}

        <DetailSection label="How we'll fix this">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3.5">
            <p className="text-[13px] text-slate-600 leading-relaxed">
              Auto-generated fixes are coming soon. In the next release, this panel will show the proposed copy/markup
              change and let you approve, edit, or skip it.
            </p>
          </div>
        </DetailSection>

        <div className="text-[12px] text-slate-400 pt-4 border-t border-slate-100">
          Detected {new Date(issue.detected_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
