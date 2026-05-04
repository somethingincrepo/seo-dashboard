"use client";

import { useMemo, useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AuditRunSummary, AuditIssue } from "@/lib/audit/queries";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type Severity = (typeof SEVERITIES)[number];

type Category = "technical" | "on-page" | "content" | "ai-geo";

const CATEGORY_LABEL: Record<Category, string> = {
  technical: "Technical",
  "on-page": "On-Page",
  content: "Content",
  "ai-geo": "AI-GEO",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
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

const SEVERITY_CARD_BORDER: Record<Severity, string> = {
  critical: "border-l-4 border-l-rose-500",
  high: "border-l-4 border-l-orange-500",
  medium: "border-l-4 border-l-amber-400",
  low: "border-l-4 border-l-emerald-400",
};

const SEVERITY_FILTER_ACTIVE: Record<Severity, string> = {
  critical: "bg-rose-500 text-white border-rose-500",
  high: "bg-orange-500 text-white border-orange-500",
  medium: "bg-amber-400 text-white border-amber-400",
  low: "bg-emerald-500 text-white border-emerald-500",
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

interface RuleGroup {
  rule_id: string;
  rule_name: string;
  severity: Severity;
  category: Category;
  scope: "page" | "site";
  issues: AuditIssue[];
}

interface Props {
  run: AuditRunSummary;
  issues: AuditIssue[];
}

type Selection =
  | { kind: "rule"; rule_id: string }
  | { kind: "issue"; issue_id: string }
  | null;

export function AuditMasterDetail(props: Props) {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
      <AuditMasterDetailInner {...props} />
    </Suspense>
  );
}

function AuditMasterDetailInner({ run: _run, issues }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────
  const initialRule = searchParams.get("rule");
  const [selection, setSelection] = useState<Selection>(
    initialRule ? { kind: "rule", rule_id: initialRule } : null,
  );
  const [urlQuery, setUrlQuery] = useState("");
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(
    new Set<Severity>(["critical", "high", "medium", "low"]),
  );
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set<Category>(["technical", "on-page", "content", "ai-geo"]),
  );

  // Auto-expand the rule group selected via ?rule= query param
  const [expandedRules, setExpandedRules] = useState<Set<string>>(
    new Set(initialRule ? [initialRule] : []),
  );

  // Strip the ?rule= param from the URL once we've consumed it (avoid stale links)
  useEffect(() => {
    if (initialRule) {
      const params = new URLSearchParams(searchParams);
      params.delete("rule");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = urlQuery.trim().toLowerCase();
    return issues.filter((i) => {
      if (i.scope === "site") return false;
      if (!activeSeverities.has(i.severity as Severity)) return false;
      if (!activeCategories.has(i.category as Category)) return false;
      if (needle && !(i.page_url ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [issues, urlQuery, activeSeverities, activeCategories]);

  // Group filtered issues by severity → rule
  const grouped = useMemo(() => {
    const out = new Map<Severity, Map<string, RuleGroup>>();
    for (const sev of SEVERITIES) out.set(sev, new Map());
    for (const i of filtered) {
      const sev = i.severity as Severity;
      const sevMap = out.get(sev)!;
      let group = sevMap.get(i.rule_id);
      if (!group) {
        group = {
          rule_id: i.rule_id,
          rule_name: i.rule_name,
          severity: sev,
          category: i.category as Category,
          scope: i.scope,
          issues: [],
        };
        sevMap.set(i.rule_id, group);
      }
      group.issues.push(i);
    }
    for (const [sev, sevMap] of out) {
      const sorted = [...sevMap.values()].sort((a, b) => b.issues.length - a.issues.length);
      out.set(sev, new Map(sorted.map((g) => [g.rule_id, g])));
    }
    return out;
  }, [filtered]);

  // Counts for filter chips (across the FULL issue set, not the filtered one,
  // so users can see what they'd unlock by toggling)
  const severityCounts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of issues) {
      if (i.scope !== "page") continue;
      c[i.severity as Severity] = (c[i.severity as Severity] ?? 0) + 1;
    }
    return c;
  }, [issues]);

  const categoryCounts = useMemo(() => {
    const c: Record<Category, number> = { technical: 0, "on-page": 0, content: 0, "ai-geo": 0 };
    for (const i of issues) {
      if (i.scope !== "page") continue;
      c[i.category as Category] = (c[i.category as Category] ?? 0) + 1;
    }
    return c;
  }, [issues]);

  // ── Selection helpers ─────────────────────────────────────────────────
  const toggleRule = useCallback((rule_id: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(rule_id)) next.delete(rule_id);
      else next.add(rule_id);
      return next;
    });
  }, []);

  const toggleSeverity = useCallback((sev: Severity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next.size === 0 ? prev : next;
    });
  }, []);

  const toggleCategory = useCallback((cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next.size === 0 ? prev : next;
    });
  }, []);

  // Resolve selection
  const detail = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "issue") {
      const issue = issues.find((i) => i.id === selection.issue_id);
      return issue ? ({ kind: "issue" as const, issue }) : null;
    }
    // rule selection — try filtered first, fall back to all-issues so a
    // ?rule=R0XX deep-link works even if filters would hide the group
    for (const sevMap of grouped.values()) {
      const g = sevMap.get(selection.rule_id);
      if (g) return { kind: "rule" as const, group: g };
    }
    const all = issues.filter((i) => i.rule_id === selection.rule_id && i.scope === "page");
    if (all.length > 0) {
      return {
        kind: "rule" as const,
        group: {
          rule_id: selection.rule_id,
          rule_name: all[0].rule_name,
          severity: all[0].severity as Severity,
          category: all[0].category as Category,
          scope: "page" as const,
          issues: all,
        },
      };
    }
    return null;
  }, [selection, issues, grouped]);

  // ── Empty state ───────────────────────────────────────────────────────
  if (issues.filter((i) => i.scope === "page").length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-slate-700 font-medium">No page-level issues found</p>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-12 gap-5 min-h-[640px]">
      {/* Filter sidebar */}
      <aside className="col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 h-fit sticky top-4 space-y-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Search</div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={urlQuery}
              onChange={(e) => setUrlQuery(e.target.value)}
              placeholder="Filter by URL…"
              className="w-full pl-8 pr-7 py-1.5 text-[13px] rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 placeholder:text-slate-400"
            />
            {urlQuery && (
              <button
                onClick={() => setUrlQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear URL filter"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Priority</div>
          <div className="space-y-1">
            {SEVERITIES.map((sev) => {
              const active = activeSeverities.has(sev);
              const count = severityCounts[sev] ?? 0;
              return (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  disabled={count === 0}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors border ${
                    active
                      ? SEVERITY_FILTER_ACTIVE[sev]
                      : count === 0
                      ? "bg-white text-slate-300 border-slate-100 cursor-not-allowed"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${active ? "bg-white/90" : SEVERITY_DOT[sev]}`} />
                    {SEVERITY_LABEL[sev]}
                  </span>
                  <span className={`tabular-nums text-[11px] ${active ? "text-white/80" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Category</div>
          <div className="space-y-1">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
              const active = activeCategories.has(cat);
              const count = categoryCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  disabled={count === 0}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors border ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : count === 0
                      ? "bg-white text-slate-300 border-slate-100 cursor-not-allowed"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{CATEGORY_LABEL[cat]}</span>
                  <span className={`tabular-nums text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            setUrlQuery("");
            setActiveSeverities(new Set(SEVERITIES));
            setActiveCategories(new Set(["technical", "on-page", "content", "ai-geo"]));
          }}
          className="text-[11px] text-slate-500 hover:text-slate-900 underline underline-offset-2"
        >
          Reset filters
        </button>
      </aside>

      {/* Rule cards (middle) */}
      <div className="col-span-4 space-y-4">
        {SEVERITIES.map((sev) => {
          const sevGroups = grouped.get(sev);
          if (!sevGroups || sevGroups.size === 0) return null;
          return (
            <div key={sev} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[sev]}`} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  {SEVERITY_LABEL[sev]}
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums">({sevGroups.size})</span>
              </div>
              {[...sevGroups.values()].map((group) => (
                <RuleCard
                  key={group.rule_id}
                  group={group}
                  expanded={expandedRules.has(group.rule_id)}
                  onToggleExpand={() => toggleRule(group.rule_id)}
                  onSelectGroup={() => setSelection({ kind: "rule", rule_id: group.rule_id })}
                  onSelectIssue={(id) => setSelection({ kind: "issue", issue_id: id })}
                  selection={selection}
                />
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-8 text-center text-sm text-slate-500">
            No issues match the current filters.
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden h-fit sticky top-4">
        {detail?.kind === "issue" && <IssueDetail issue={detail.issue} />}
        {detail?.kind === "rule" && (
          <RuleDetail group={detail.group} onPickIssue={(id) => setSelection({ kind: "issue", issue_id: id })} />
        )}
        {!detail && (
          <div className="h-[480px] flex items-center justify-center text-slate-400 text-sm px-6 text-center">
            Pick a rule on the left to see what it means and the affected pages.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rule card ──────────────────────────────────────────────────────────

function RuleCard({
  group,
  expanded,
  onToggleExpand,
  onSelectGroup,
  onSelectIssue,
  selection,
}: {
  group: RuleGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectGroup: () => void;
  onSelectIssue: (issueId: string) => void;
  selection: Selection;
}) {
  const isSelected = selection?.kind === "rule" && selection.rule_id === group.rule_id;
  const previewIssues = expanded ? group.issues : group.issues.slice(0, 0);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all ${
        SEVERITY_CARD_BORDER[group.severity]
      } border-y border-r border-slate-200/80 ${isSelected ? "ring-2 ring-indigo-200" : ""}`}
    >
      <button onClick={onSelectGroup} className="w-full text-left px-3.5 pt-2.5 pb-2 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-slate-900 leading-snug">
              {group.rule_name}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
                {CATEGORY_LABEL[group.category]}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {group.issues.length} page{group.issues.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </button>
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-center gap-1 px-3 py-1 text-[11px] text-slate-500 hover:text-slate-900 border-t border-slate-100 hover:bg-slate-50 transition-colors"
      >
        <span>{expanded ? "Hide pages" : `Show all ${group.issues.length} page${group.issues.length === 1 ? "" : "s"}`}</span>
        <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 max-h-64 overflow-y-auto">
          {previewIssues.map((i) => {
            const issueSelected = selection?.kind === "issue" && selection.issue_id === i.id;
            return (
              <button
                key={i.id}
                onClick={() => onSelectIssue(i.id)}
                className={`w-full text-left px-3.5 py-1.5 text-[12px] truncate ${
                  issueSelected
                    ? "bg-indigo-50 text-indigo-900 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
                title={i.page_url ?? ""}
              >
                {pageLabel(i.page_url)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Right detail: rule overview ─────────────────────────────────────────

function RuleDetail({ group, onPickIssue }: { group: RuleGroup; onPickIssue: (id: string) => void }) {
  const sample = group.issues[0];
  const ruleDescription = (sample?.evidence as { rule_description?: string } | null)?.rule_description;
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
      <div className="p-7 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${SEVERITY_PILL[group.severity]} font-semibold uppercase tracking-wider`}>
              {SEVERITY_LABEL[group.severity]}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {CATEGORY_LABEL[group.category]}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70">
              {group.issues.length} page{group.issues.length === 1 ? "" : "s"}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 leading-tight">{group.rule_name}</h2>
        </div>

        {ruleDescription && (
          <DetailSection label="What this means">
            <p className="text-[13.5px] text-slate-700 leading-relaxed">{ruleDescription}</p>
          </DetailSection>
        )}

        {sample?.expected_value && (
          <DetailSection label="What's expected">
            <p className="text-[13.5px] text-slate-700 leading-relaxed">{sample.expected_value}</p>
          </DetailSection>
        )}

        <DetailSection label={`Affected pages (${group.issues.length})`}>
          <div className="rounded-lg border border-slate-200/80 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {group.issues.map((i) => (
              <button
                key={i.id}
                onClick={() => onPickIssue(i.id)}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-700 truncate group-hover:text-indigo-700">
                    {pageLabel(i.page_url)}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate flex-1 text-right">
                    {truncate(i.page_url ?? "", 60)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

// ─── Right detail: single issue ──────────────────────────────────────────

function IssueDetail({ issue }: { issue: AuditIssue }) {
  const sev = issue.severity as Severity;
  const ev = issue.evidence as
    | { fix_guidance?: string; rule_description?: string; [k: string]: unknown }
    | null;
  const fixGuidance = ev?.fix_guidance;
  const ruleDescription = ev?.rule_description;

  // Strip our injected meta from the displayed evidence dump
  const evidenceForDisplay = ((): Record<string, unknown> | null => {
    if (!ev || typeof ev !== "object") return null;
    const rest: Record<string, unknown> = { ...ev };
    delete rest.fix_guidance;
    delete rest.rule_description;
    return Object.keys(rest).length > 0 ? rest : null;
  })();

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
      <div className="p-7 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${SEVERITY_PILL[sev]} font-semibold uppercase tracking-wider`}>
              {SEVERITY_LABEL[sev]}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {CATEGORY_LABEL[issue.category as Category] ?? issue.category}
            </span>
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

        {ruleDescription && (
          <DetailSection label="What this means">
            <p className="text-[13.5px] text-slate-700 leading-relaxed">{ruleDescription}</p>
          </DetailSection>
        )}

        <DetailSection label="What we found on this page">
          <pre className="font-mono text-[13px] text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 whitespace-pre-wrap break-words">
            {issue.current_value ?? "—"}
          </pre>
        </DetailSection>

        <DetailSection label="What's expected">
          <p className="text-[13.5px] text-slate-700 leading-relaxed">{issue.expected_value ?? "—"}</p>
        </DetailSection>

        <DetailSection label="How to fix this page">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3.5">
            <p className="text-[13.5px] text-slate-800 leading-relaxed">
              {fixGuidance ?? "We'll detail the specific fix steps for this rule in a future release."}
            </p>
          </div>
        </DetailSection>

        {evidenceForDisplay && (
          <DetailSection label="Evidence">
            <pre className="font-mono text-[12px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5 whitespace-pre-wrap break-words overflow-x-auto">
              {JSON.stringify(evidenceForDisplay, null, 2)}
            </pre>
          </DetailSection>
        )}

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
