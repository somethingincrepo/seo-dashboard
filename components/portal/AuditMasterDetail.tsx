"use client";

import { useMemo, useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AuditRunSummary, AuditIssue, IssueDecision } from "@/lib/audit/queries";
import { computeHealthScore } from "@/lib/audit/healthScore";
import { AuditDonut } from "./AuditDonut";
import { getFixGuidance } from "@/lib/audit/rules/fix-guidance";
import { ImplementationGuide } from "./ImplementationGuide";
import { AutoModeNotice } from "./AutoModeNotice";
import { resolveGuide, deliverableFromChangeType, deliverableForIssue } from "@/lib/implementation-guides";
import type { Client } from "@/lib/clients";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type Severity = (typeof SEVERITIES)[number];
type SeverityFilter = "all" | Severity;

type Category = "technical" | "on-page" | "content" | "ai-geo";
type CategoryFilter = "all" | Category | "approved" | "resolved";

const SEVERITY_LABEL: Record<Severity, string> = {
 critical: "Critical",
 high: "High",
 medium: "Medium",
 low: "Low",
};

const CATEGORY_LABEL: Record<Category, string> = {
 technical: "Technical",
 "on-page": "On-Page",
 content: "Content",
 "ai-geo": "AI-GEO",
};

const SEVERITY_DOT: Record<Severity, string> = {
 critical: "bg-rose-500",
 high: "bg-orange-500",
 medium: "bg-amber-400",
 low: "bg-emerald-500",
};

const SEVERITY_PILL: Record<Severity, string> = {
 critical: "bg-rose-50 text-rose-700 ring-rose-200/70",
 high: "bg-orange-50 text-orange-700 ring-orange-200/70",
 medium: "bg-amber-50 text-amber-700 ring-amber-200/70",
 low: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
};

const SEVERITY_BORDER: Record<Severity, string> = {
 critical: "border-l-4 border-l-rose-500",
 high: "border-l-4 border-l-orange-500",
 medium: "border-l-4 border-l-amber-400",
 low: "border-l-4 border-l-emerald-500",
};

const SEVERITY_HEX: Record<Severity, string> = {
 critical: "#f43f5e",
 high: "#f97316",
 medium: "#fbbf24",
 low: "#10b981",
};

const CATEGORY_BAR_COLOR: Record<Category, string> = {
 technical: "bg-indigo-500",
 "on-page": "bg-violet-500",
 content: "bg-sky-500",
 "ai-geo": "bg-emerald-500",
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
 token: string;
 client: Client;
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

function AuditMasterDetailInner({ run, issues, token, client }: Props) {
 const searchParams = useSearchParams();
 const router = useRouter();

 const initialRule = searchParams.get("rule");
 const [selection, setSelection] = useState<Selection>(
 initialRule ? { kind: "rule", rule_id: initialRule } : null,
 );
 const [severity, setSeverity] = useState<SeverityFilter>("all");
 const [category, setCategory] = useState<CategoryFilter>("all");
 const [urlQuery, setUrlQuery] = useState("");
 const [expandedRules, setExpandedRules] = useState<Set<string>>(
 new Set(initialRule ? [initialRule] : []),
 );

 // ─── Approval state ────────────────────────────────────────────────────
 // Local decisions overlay the server's decision field for instant UI updates.
 const [localDecisions, setLocalDecisions] = useState<Map<string, IssueDecision>>(() => {
 const m = new Map<string, IssueDecision>();
 for (const i of issues) if (i.decision) m.set(i.id, i.decision);
 return m;
 });
 const [showDismissed, setShowDismissed] = useState(false);
 const [selectMode, setSelectMode] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [submitting, setSubmitting] = useState(false);
 const [sortMode, setSortMode] = useState<"priority" | "affected">("priority");
 const [mainPagesOnly, setMainPagesOnly] = useState(false);

 const decisionFor = useCallback(
 (issueId: string): IssueDecision => {
 if (localDecisions.has(issueId)) return localDecisions.get(issueId) ?? null;
 const i = issues.find((x) => x.id === issueId);
 return i?.decision ?? null;
 },
 [localDecisions, issues],
 );

 const decide = useCallback(
 async (issueIds: string[], decision: IssueDecision) => {
 if (issueIds.length === 0) return;
 setSubmitting(true);
 // Optimistic
 setLocalDecisions((prev) => {
 const next = new Map(prev);
 for (const id of issueIds) {
 if (decision === null) next.delete(id);
 else next.set(id, decision);
 }
 return next;
 });
 try {
 const r = await fetch(`/api/portal/audit-decide?token=${encodeURIComponent(token)}`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ issue_ids: issueIds, decision }),
 });
 if (!r.ok) throw new Error(`HTTP ${r.status}`);
 } catch (e) {
 console.error("[audit-decide]", e);
 // Rollback on failure
 setLocalDecisions((prev) => {
 const next = new Map(prev);
 for (const id of issueIds) {
 const original = issues.find((x) => x.id === id)?.decision ?? null;
 if (original === null) next.delete(id);
 else next.set(id, original);
 }
 return next;
 });
 } finally {
 setSubmitting(false);
 }
 },
 [token, issues],
 );

 const exitSelectMode = useCallback(() => {
 setSelectMode(false);
 setSelectedIds(new Set());
 }, []);

 // Strip ?rule= from URL once consumed
 useEffect(() => {
 if (initialRule) {
 const params = new URLSearchParams(searchParams);
 params.delete("rule");
 const qs = params.toString();
 router.replace(qs ? `?${qs}` : "?", { scroll: false });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Issues visible in the panel — both page-scope and site-scope, hiding dismissed unless toggled.
 // (Header total uses `issues_found` from audit_runs which counts both scopes; we count both
 // here too so the donut + sidebar match the header.)
 const visibleIssues = useMemo(() => issues.filter((i) => {
 const d = localDecisions.get(i.id) ?? i.decision;
 if (d === "dismissed" && !showDismissed) return false;
 if (d === "resolved") return false;
 return true;
 }), [issues, localDecisions, showDismissed]);

 // Page issues only — used where rendering per-URL detail (rule cards) needs a page_url.
 const pageIssues = useMemo(() => visibleIssues.filter((i) => i.scope === "page"), [visibleIssues]);

 // Resolved page issues — separate pool for the Resolved tab.
 const resolvedPageIssues = useMemo(
 () => issues.filter((i) => i.scope === "page" && (localDecisions.get(i.id) ?? i.decision) === "resolved"),
 [issues, localDecisions],
 );

 const dismissedCount = useMemo(
 () => issues.filter((i) => (localDecisions.get(i.id) ?? i.decision) === "dismissed").length,
 [issues, localDecisions],
 );
 const approvedCount = useMemo(
 () => issues.filter((i) => (localDecisions.get(i.id) ?? i.decision) === "approved").length,
 [issues, localDecisions],
 );
 const resolvedCount = useMemo(
 () => issues.filter((i) => (localDecisions.get(i.id) ?? i.decision) === "resolved").length,
 [issues, localDecisions],
 );

 // Distinct issue types = unique rule_ids in the page-scope visible pool.
 // One rule firing on 20 pages = 1 issue type. Per-page detail is preserved
 // in group.issues.length inside each RuleCard.
 const distinctIssueTypes = useMemo(
 () => new Set(pageIssues.map((i) => i.rule_id)).size,
 [pageIssues],
 );

 const severityCounts = useMemo(() => {
 const seen = new Set<string>();
 const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
 for (const i of pageIssues) {
 if (seen.has(i.rule_id)) continue;
 seen.add(i.rule_id);
 c[i.severity as Severity] = (c[i.severity as Severity] ?? 0) + 1;
 }
 return c;
 }, [pageIssues]);

 const categoryCounts = useMemo(() => {
 const seen = new Set<string>();
 const c: Record<Category, number> = { technical: 0, "on-page": 0, content: 0, "ai-geo": 0 };
 for (const i of pageIssues) {
 if (seen.has(i.rule_id)) continue;
 seen.add(i.rule_id);
 c[i.category as Category] = (c[i.category as Category] ?? 0) + 1;
 }
 return c;
 }, [pageIssues]);

 const affectedPages = useMemo(() => {
 const set = new Set<string>();
 for (const i of pageIssues) if (i.page_url) set.add(i.page_url);
 return set.size;
 }, [pageIssues]);

 const totalPagesCrawled = run.pages_crawled ?? 0;
 // Severity-weighted score (see lib/audit/healthScore.ts). The previous
 // ratio-of-clean-pages formula always rounded to 0% on real sites because
 // every page has at least one minor finding — this rewards fixing the
 // serious stuff and ignores low-severity background noise. Dismissed
 // issues are excluded from the score so a customer dismissing a false
 // positive sees the number move.
 const healthPct = useMemo(() => {
 const scoreable = issues.filter((i) => {
 const d = localDecisions.get(i.id) ?? i.decision;
 return d !== "dismissed" && d !== "resolved";
 });
 return computeHealthScore(scoreable, totalPagesCrawled);
 }, [issues, localDecisions, totalPagesCrawled]);

 const filtered = useMemo(() => {
 const needle = urlQuery.trim().toLowerCase();
 const pool = category === "resolved" ? resolvedPageIssues : pageIssues;
 return pool.filter((i) => {
 if (severity !== "all" && i.severity !== severity) return false;
 if (category === "approved") {
 if (decisionFor(i.id) !== "approved") return false;
 } else if (category !== "all" && category !== "resolved") {
 if (i.category !== category) return false;
 }
 if (needle && !(i.page_url ?? "").toLowerCase().includes(needle)) return false;
 if (mainPagesOnly && i.page_url) {
 try {
 const segs = new URL(i.page_url).pathname.replace(/\/$/, "").split("/").filter(Boolean);
 if (segs.length > 1) return false;
 } catch { /* keep */ }
 }
 return true;
 });
 }, [pageIssues, resolvedPageIssues, severity, category, urlQuery, decisionFor, mainPagesOnly]);

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

 const flatSortedGroups = useMemo(() => {
 const all: RuleGroup[] = [];
 for (const sevMap of grouped.values()) all.push(...sevMap.values());
 return all.sort((a, b) => b.issues.length - a.issues.length);
 }, [grouped]);

 const toggleRule = useCallback((rule_id: string) => {
 setExpandedRules((prev) => {
 const next = new Set(prev);
 if (next.has(rule_id)) next.delete(rule_id);
 else next.add(rule_id);
 return next;
 });
 }, []);

 const detail = useMemo(() => {
 if (!selection) return null;
 if (selection.kind === "issue") {
 const issue = issues.find((i) => i.id === selection.issue_id);
 return issue ? { kind: "issue" as const, issue } : null;
 }
 for (const sevMap of grouped.values()) {
 const g = sevMap.get(selection.rule_id);
 if (g) return { kind: "rule" as const, group: g };
 }
 const all = pageIssues.filter((i) => i.rule_id === selection.rule_id);
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
 }, [selection, issues, pageIssues, grouped]);

 const donutSlices = SEVERITIES.map((sev) => ({
 key: sev,
 label: SEVERITY_LABEL[sev],
 value: severityCounts[sev] ?? 0,
 textColor: "",
 strokeColor: SEVERITY_HEX[sev],
 }));

 if (pageIssues.length === 0) {
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

 return (
 <div className="space-y-5">
 {/* ─── Dashboard header (3 panels: health · severity · category) ─ */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
 {/* Panel 1: Health score */}
 <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3 flex items-center gap-3">
 <HealthDial pct={healthPct} />
 <div className="min-w-0 flex-1">
 <div className="text-[10px] font-semibold tracking-widest text-slate-400">Site health</div>
 <div className="text-[13px] text-slate-700 mt-1 leading-snug">
 <span className="text-slate-900 font-semibold">{distinctIssueTypes}</span> issue type{distinctIssueTypes !== 1 ? "s" : ""} across <span className="text-slate-900 font-semibold">{affectedPages}</span> page{affectedPages !== 1 ? "s" : ""}.
 </div>
 <div className="text-[11.5px] text-slate-500 mt-1">
 {pageIssues.length.toLocaleString()} total instance{pageIssues.length !== 1 ? "s" : ""} · {totalPagesCrawled} pages crawled
 </div>
 </div>
 </div>

 {/* Panel 2: Severity donut + legend */}
 <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3">
 <div className="text-[10px] font-semibold tracking-widest text-slate-400 mb-2">By priority</div>
 <div className="flex items-center gap-3">
 <AuditDonut
 slices={donutSlices}
 activeKey={severity}
 onSliceClick={(k) => setSeverity((cur) => (cur === k ? "all" : (k as SeverityFilter)))}
 centerValue={distinctIssueTypes}
 size={92}
 thickness={11}
 />
 <div className="flex-1 min-w-0 space-y-1">
 {SEVERITIES.map((sev) => {
 const count = severityCounts[sev] ?? 0;
 const isActive = severity === sev;
 const pct = distinctIssueTypes > 0 ? Math.round((count / distinctIssueTypes) * 100) : 0;
 return (
 <button
 key={sev}
 onClick={() => setSeverity(isActive ? "all" : sev)}
 className={`w-full flex items-center gap-2 text-[11.5px] transition-colors ${count === 0 ? "opacity-40" : "hover:text-slate-900"}`}
 >
 <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[sev]}`} />
 <span className={`flex-1 text-left truncate ${isActive ? "text-slate-900 font-medium" : "text-slate-600"}`}>
 {SEVERITY_LABEL[sev]}
 </span>
 <span className="tabular-nums text-slate-700 font-medium">{count}</span>
 <span className="tabular-nums text-slate-400 w-7 text-right">{pct}%</span>
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Panel 3: Category bars */}
 <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3">
 <div className="text-[10px] font-semibold tracking-widest text-slate-400 mb-2">By category</div>
 <div className="space-y-1.5">
 {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
 const count = categoryCounts[cat] ?? 0;
 const max = Math.max(1, ...Object.values(categoryCounts));
 const w = (count / max) * 100;
 const isActive = category === cat;
 const barColor = CATEGORY_BAR_COLOR[cat];
 return (
 <button
 key={cat}
 onClick={() => setCategory(isActive ? "all" : cat)}
 className="w-full text-left group"
 disabled={count === 0}
 >
 <div className="flex items-center justify-between text-[11.5px] mb-0.5">
 <span className={`${isActive ? "text-slate-900 font-medium" : "text-slate-600 group-hover:text-slate-900"} ${count === 0 ? "opacity-40" : ""}`}>
 {CATEGORY_LABEL[cat]}
 </span>
 <span className="tabular-nums text-slate-700 font-medium">{count}</span>
 </div>
 <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${barColor} ${isActive ? "" : "opacity-80 group-hover:opacity-100"}`}
 style={{ width: `${w}%` }}
 />
 </div>
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* ─── Top horizontal tabs (category) + URL search ──────────── */}
 <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm">
 <div className="flex items-center justify-between gap-3 px-3 py-1.5">
 <div className="flex items-center gap-1 overflow-x-auto">
 <CategoryTab
 label="All issues"
 count={distinctIssueTypes}
 active={category === "all"}
 onClick={() => setCategory("all")}
 />
 {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
 <CategoryTab
 key={cat}
 label={CATEGORY_LABEL[cat]}
 count={categoryCounts[cat] ?? 0}
 active={category === cat}
 onClick={() => setCategory(cat)}
 />
 ))}
 {(approvedCount > 0 || resolvedCount > 0) && (
 <span className="w-px h-4 self-center bg-slate-200 mx-0.5 shrink-0" />
 )}
 {approvedCount > 0 && (
 <button
 onClick={() => setCategory(category === "approved" ? "all" : "approved")}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-all ${
 category === "approved"
 ? "bg-emerald-600 text-white"
 : "text-emerald-700 hover:bg-emerald-50"
 }`}
 >
 <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 <span>Approved</span>
 <span className={`tabular-nums text-[11px] ${category === "approved" ? "text-emerald-100" : "text-emerald-500"}`}>{approvedCount}</span>
 </button>
 )}
 {resolvedCount > 0 && (
 <button
 onClick={() => setCategory(category === "resolved" ? "all" : "resolved")}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-all ${
 category === "resolved"
 ? "bg-slate-700 text-white"
 : "text-slate-600 hover:bg-slate-50"
 }`}
 >
 <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="12" r="10"/>
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 <span>Resolved</span>
 <span className={`tabular-nums text-[11px] ${category === "resolved" ? "text-slate-300" : "text-slate-400"}`}>{resolvedCount}</span>
 </button>
 )}
 </div>
 <div className="relative w-64 shrink-0">
 <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="11" cy="11" r="8"/>
 <line x1="21" y1="21" x2="16.65" y2="16.65"/>
 </svg>
 <input
 type="text"
 value={urlQuery}
 onChange={(e) => setUrlQuery(e.target.value)}
 placeholder="Filter by URL…"
 className="w-full pl-8 pr-7 py-1.5 text-[12.5px] rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 placeholder:text-slate-400"
 />
 {urlQuery && (
 <button
 onClick={() => setUrlQuery("")}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
 aria-label="Clear"
 >
 <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <line x1="18" y1="6" x2="6" y2="18"/>
 <line x1="6" y1="6" x2="18" y2="18"/>
 </svg>
 </button>
 )}
 </div>
 </div>
 </div>

 {/* ─── Body: left severity nav + middle cards + right detail ── */}
 <div className="grid grid-cols-12 gap-4">
 <aside className="col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3 h-fit sticky top-4 space-y-1">
 <div className="text-[10px] font-semibold tracking-widest text-slate-400 px-2 mb-1">Priority</div>
 <SidebarItem
 label="All priorities"
 count={distinctIssueTypes}
 active={severity === "all"}
 dotClass="bg-slate-300"
 onClick={() => setSeverity("all")}
 />
 {SEVERITIES.map((sev) => (
 <SidebarItem
 key={sev}
 label={SEVERITY_LABEL[sev]}
 count={severityCounts[sev] ?? 0}
 active={severity === sev}
 dotClass={SEVERITY_DOT[sev]}
 onClick={() => setSeverity(severity === sev ? "all" : sev)}
 />
 ))}
 </aside>

 <div className="col-span-5 space-y-3">
 {/* Approved-view banner */}
 {category === "approved" && (
 <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-start gap-3">
 <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 <div>
 <p className="text-[13px] font-medium text-emerald-900">Implementation queue</p>
 <p className="text-[12px] text-emerald-700 mt-0.5 leading-snug">
 Select any issue to see step-by-step instructions for your CMS. Once the fix is live, click <strong>Mark resolved</strong> to move it to the Resolved tab.
 </p>
 </div>
 </div>
 )}
 {/* Resolved-view banner */}
 {category === "resolved" && (
 <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 flex items-start gap-3">
 <svg className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="12" r="10"/>
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 <div>
 <p className="text-[13px] font-medium text-slate-700">Resolved fixes</p>
 <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
 These issues have been implemented. They are excluded from your health score and won't appear in the main issues list.
 </p>
 </div>
 </div>
 )}
 {/* Toolbar above rule cards — sort · filter · bulk select · dismissed toggle */}
 <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
 <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
 {approvedCount > 0 && (
 <span className="inline-flex items-center gap-1 text-emerald-700">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 <span className="tabular-nums font-medium">{approvedCount}</span> approved
 </span>
 )}
 {approvedCount > 0 && dismissedCount > 0 && <span className="text-slate-300">·</span>}
 {dismissedCount > 0 && (
 <button
 onClick={() => setShowDismissed((s) => !s)}
 className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
 >
 <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
 <span className="tabular-nums font-medium">{dismissedCount}</span>{" "}
 dismissed{" "}
 <span className="underline underline-offset-2">{showDismissed ? "(hide)" : "(show)"}</span>
 </button>
 )}
 </div>
 <div className="flex items-center gap-1.5">
 {/* Main pages filter */}
 <button
 onClick={() => setMainPagesOnly((v) => !v)}
 title="Show only top-level pages (homepage + 1-segment paths)"
 className={`text-[11.5px] px-2.5 py-1 rounded-md transition-colors border ${
 mainPagesOnly
 ? "bg-indigo-600 text-white border-indigo-600"
 : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
 }`}
 >
 Main pages
 </button>
 {/* Sort mode toggle */}
 <button
 onClick={() => setSortMode((m) => (m === "priority" ? "affected" : "priority"))}
 title={sortMode === "priority" ? "Sort by most URLs affected" : "Sort by severity priority"}
 className={`text-[11.5px] px-2.5 py-1 rounded-md transition-colors border ${
 sortMode === "affected"
 ? "bg-indigo-600 text-white border-indigo-600"
 : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
 }`}
 >
 {sortMode === "priority" ? "Sort: Priority" : "Sort: Most affected"}
 </button>
 {/* Bulk select */}
 <button
 onClick={() => {
 if (selectMode) exitSelectMode();
 else setSelectMode(true);
 }}
 className={`text-[11.5px] px-2.5 py-1 rounded-md transition-colors border ${
 selectMode
 ? "bg-slate-900 text-white border-slate-900"
 : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
 }`}
 >
 {selectMode ? `Cancel selection${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}` : "Select multiple"}
 </button>
 </div>
 </div>

 {sortMode === "affected" ? (
 <div className="space-y-2">
 {flatSortedGroups.map((group) => (
 <RuleCard
 key={group.rule_id}
 group={group}
 expanded={expandedRules.has(group.rule_id)}
 onToggleExpand={() => toggleRule(group.rule_id)}
 onSelectGroup={() => setSelection({ kind: "rule", rule_id: group.rule_id })}
 onSelectIssue={(id) => setSelection({ kind: "issue", issue_id: id })}
 selection={selection}
 selectMode={selectMode}
 selectedIds={selectedIds}
 onToggleIssueSelection={(id) =>
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 })
 }
 onToggleAllSelection={() =>
 setSelectedIds((prev) => {
 const allIds = group.issues.map((i) => i.id);
 const allSelected = allIds.every((id) => prev.has(id));
 const next = new Set(prev);
 for (const id of allIds) {
 if (allSelected) next.delete(id);
 else next.add(id);
 }
 return next;
 })
 }
 decisionFor={decisionFor}
 />
 ))}
 {flatSortedGroups.length === 0 && (
 <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-8 text-center text-sm text-slate-500">
 No issues match the current filters.
 </div>
 )}
 </div>
 ) : (
 <>
 {SEVERITIES.map((sev) => {
 const sevGroups = grouped.get(sev);
 if (!sevGroups || sevGroups.size === 0) return null;
 return (
 <div key={sev} className="space-y-2">
 <div className="flex items-center gap-2 px-1">
 <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[sev]}`} />
 <span className="text-[11px] font-semibold tracking-widest text-slate-500">
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
 selectMode={selectMode}
 selectedIds={selectedIds}
 onToggleIssueSelection={(id) =>
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 })
 }
 onToggleAllSelection={() =>
 setSelectedIds((prev) => {
 const allIds = group.issues.map((i) => i.id);
 const allSelected = allIds.every((id) => prev.has(id));
 const next = new Set(prev);
 for (const id of allIds) {
 if (allSelected) next.delete(id);
 else next.add(id);
 }
 return next;
 })
 }
 decisionFor={decisionFor}
 />
 ))}
 </div>
 );
 })}
 {filtered.length === 0 && (
 <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-8 text-center text-sm text-slate-500">
 {category === "approved"
 ? "No approved issues yet. Approve issues from the other tabs to see implementation instructions here."
 : category === "resolved"
 ? "No resolved issues yet. After implementing a fix, mark it resolved from the Approved tab."
 : "No issues match the current filters."}
 </div>
 )}
 </>
 )}
 </div>

 <div className="col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden h-fit sticky top-4 min-h-[640px]">
 {detail?.kind === "issue" && (
 <IssueDetail
 issue={detail.issue}
 decisionFor={decisionFor}
 decide={decide}
 submitting={submitting}
 token={token}
 client={client}
 />
 )}
 {detail?.kind === "rule" && (
 <RuleDetail
 group={detail.group}
 onPickIssue={(id) => setSelection({ kind: "issue", issue_id: id })}
 decisionFor={decisionFor}
 decide={decide}
 submitting={submitting}
 />
 )}
 {!detail && <DetailPlaceholder />}
 </div>
 </div>

 {/* ─── Floating bulk action bar (when issues are selected) ──── */}
 {selectMode && selectedIds.size > 0 && (
 <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 px-4 py-2.5 flex items-center gap-3">
 <span className="text-[13px] font-medium tabular-nums">
 {selectedIds.size} selected
 </span>
 <span className="w-px h-5 bg-slate-700" />
 <button
 onClick={async () => {
 await decide([...selectedIds], "approved");
 exitSelectMode();
 }}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-[12.5px] font-medium disabled:opacity-50"
 >
 Approve
 </button>
 <button
 onClick={async () => {
 await decide([...selectedIds], "dismissed");
 exitSelectMode();
 }}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-[12.5px] font-medium disabled:opacity-50"
 >
 Dismiss
 </button>
 <button
 onClick={exitSelectMode}
 className="px-2 py-1 text-[12.5px] text-slate-400 hover:text-white"
 >
 Cancel
 </button>
 </div>
 )}
 </div>
 );
}

// ─── Empty detail placeholder ─────────────────────────────────────────

function DetailPlaceholder() {
 return (
 <div className="h-full min-h-[640px] flex flex-col items-center justify-center text-center px-8 py-10">
 <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
 <svg className="w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
 </svg>
 </div>
 <p className="text-slate-700 font-medium text-[14px]">Pick an issue to see details</p>
 <p className="text-slate-500 text-[12.5px] mt-2 max-w-sm leading-relaxed">
 Click a rule on the left to see what it means, why it matters, and the full list of affected pages.
 Then click any page to see a fix specific to that URL.
 </p>
 </div>
 );
}

// ─── Bits ──────────────────────────────────────────────────────────────

function HealthDial({ pct }: { pct: number }) {
 // Choose color stop by health bucket
 const color = pct >= 70 ? "rgb(16 185 129)" : pct >= 40 ? "rgb(245 158 11)" : "rgb(244 63 94)";
 const ring = `conic-gradient(${color} ${(pct * 3.6).toFixed(1)}deg, rgb(241 245 249) 0deg)`;
 return (
 <div className="relative w-[88px] h-[88px] rounded-full shrink-0" style={{ background: ring }}>
 <div className="absolute inset-[6px] rounded-full bg-white flex flex-col items-center justify-center">
 <span className="text-[22px] font-semibold tabular-nums text-slate-900 leading-none">{pct}%</span>
 <span className="text-[9px] tracking-widest text-slate-500 mt-1">healthy</span>
 </div>
 </div>
 );
}

function SidebarItem({
 label,
 count,
 active,
 dotClass,
 onClick,
}: {
 label: string;
 count: number;
 active: boolean;
 dotClass: string;
 onClick: () => void;
}) {
 return (
 <button
 onClick={onClick}
 className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
 active ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
 }`}
 >
 <span className={`w-2 h-2 rounded-full ${dotClass}`} />
 <span className="flex-1 text-left">{label}</span>
 <span className={`tabular-nums text-[11px] ${active ? "text-slate-500" : "text-slate-400"}`}>{count}</span>
 </button>
 );
}

function CategoryTab({
 label,
 count,
 active,
 onClick,
}: {
 label: string;
 count: number;
 active: boolean;
 onClick: () => void;
}) {
 return (
 <button
 onClick={onClick}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-all ${
 active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
 }`}
 >
 <span>{label}</span>
 <span className={`tabular-nums text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>{count}</span>
 </button>
 );
}

function RuleCard({
 group,
 expanded,
 onToggleExpand,
 onSelectGroup,
 onSelectIssue,
 selection,
 selectMode,
 selectedIds,
 onToggleIssueSelection,
 onToggleAllSelection,
 decisionFor,
}: {
 group: RuleGroup;
 expanded: boolean;
 onToggleExpand: () => void;
 onSelectGroup: () => void;
 onSelectIssue: (issueId: string) => void;
 selection: Selection;
 selectMode: boolean;
 selectedIds: Set<string>;
 onToggleIssueSelection: (id: string) => void;
 onToggleAllSelection: () => void;
 decisionFor: (id: string) => IssueDecision;
}) {
 const groupIds = group.issues.map((i) => i.id);
 const allSelected = selectMode && groupIds.every((id) => selectedIds.has(id));
 const someSelected = selectMode && groupIds.some((id) => selectedIds.has(id));
 const groupApproved = group.issues.every((i) => decisionFor(i.id) === "approved");
 const groupDismissed = group.issues.every((i) => decisionFor(i.id) === "dismissed");
 const groupResolved = group.issues.every((i) => decisionFor(i.id) === "resolved");
 const isSelected = selection?.kind === "rule" && selection.rule_id === group.rule_id;
 return (
 <div
 className={`bg-white rounded-lg shadow-sm overflow-hidden ${
 SEVERITY_BORDER[group.severity]
 } border-y border-r border-slate-200/80 ${isSelected ? "ring-2 ring-indigo-300" : ""} ${
 groupApproved ? "opacity-80" : ""
 } ${groupDismissed || groupResolved ? "opacity-50" : ""}`}
 >
 <div className="flex items-stretch">
 {selectMode && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggleAllSelection();
 }}
 className="flex items-center justify-center px-3 hover:bg-slate-50 border-r border-slate-100"
 aria-label={allSelected ? "Deselect all pages" : "Select all pages"}
 >
 <span
 className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
 allSelected
 ? "bg-indigo-500 border-indigo-500"
 : someSelected
 ? "bg-indigo-50 border-indigo-400"
 : "bg-white border-slate-300"
 }`}
 >
 {allSelected && (
 <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12" />
 </svg>
 )}
 {!allSelected && someSelected && <span className="w-2 h-0.5 bg-indigo-500 rounded" />}
 </span>
 </button>
 )}
 <button onClick={onSelectGroup} className="flex-1 text-left px-4 pt-3 pb-2 hover:bg-slate-50/50 transition-colors">
 <div className="text-[14px] font-medium text-slate-900 leading-snug">{group.rule_name}</div>
 <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
 {CATEGORY_LABEL[group.category]}
 </span>
 <span className="text-[11px] text-slate-500 tabular-nums">
 {group.issues.length} page{group.issues.length === 1 ? "" : "s"}
 </span>
 {groupApproved && (
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 font-medium">
 ✓ All approved
 </span>
 )}
 {groupResolved && (
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70 font-medium">
 ✓ All resolved
 </span>
 )}
 {groupDismissed && (
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
 Dismissed
 </span>
 )}
 </div>
 </button>
 </div>
 <button
 onClick={onToggleExpand}
 className="w-full flex items-center justify-center gap-1 px-3 py-1 text-[11px] text-slate-500 hover:text-slate-900 border-t border-slate-100 hover:bg-slate-50"
 >
 <span>{expanded ? "Hide pages" : `Show all ${group.issues.length} page${group.issues.length === 1 ? "" : "s"}`}</span>
 <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="6 9 12 15 18 9"/>
 </svg>
 </button>
 {expanded && (
 <div className="border-t border-slate-100 max-h-64 overflow-y-auto">
 {group.issues.map((i) => {
 const issueSelected = selection?.kind === "issue" && selection.issue_id === i.id;
 const decision = decisionFor(i.id);
 const isChecked = selectedIds.has(i.id);
 return (
 <div key={i.id} className="flex items-stretch">
 {selectMode && (
 <button
 onClick={() => onToggleIssueSelection(i.id)}
 className="flex items-center justify-center px-3 hover:bg-slate-50 border-r border-slate-100"
 aria-label={isChecked ? "Deselect page" : "Select page"}
 >
 <span
 className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
 isChecked ? "bg-indigo-500 border-indigo-500" : "bg-white border-slate-300"
 }`}
 >
 {isChecked && (
 <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12" />
 </svg>
 )}
 </span>
 </button>
 )}
 <button
 onClick={() => onSelectIssue(i.id)}
 className={`flex-1 flex items-center gap-2 text-left px-4 py-1.5 text-[12px] ${
 issueSelected
 ? "bg-indigo-50 text-indigo-900 font-medium"
 : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
 }`}
 title={i.page_url ?? ""}
 >
 <span className="flex-1 truncate">{pageLabel(i.page_url)}</span>
 {decision === "approved" && (
 <span className="text-[10px] text-emerald-600 font-medium shrink-0">✓ approved</span>
 )}
 {decision === "resolved" && (
 <span className="text-[10px] text-slate-500 font-medium shrink-0">✓ resolved</span>
 )}
 {decision === "dismissed" && (
 <span className="text-[10px] text-slate-400 shrink-0">dismissed</span>
 )}
 </button>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}

function RuleDetail({
 group,
 onPickIssue,
 decisionFor,
 decide,
 submitting,
}: {
 group: RuleGroup;
 onPickIssue: (id: string) => void;
 decisionFor: (id: string) => IssueDecision;
 decide: (ids: string[], decision: IssueDecision) => Promise<void>;
 submitting: boolean;
}) {
 const sample = group.issues[0];
 const ruleDescription = (sample?.evidence as { rule_description?: string } | null)?.rule_description;
 // Rule-level guidance is generic (applies to every affected page).
 // The per-page fix_guidance lives on each issue's evidence and shows up in IssueDetail.
 const ruleGuidance = getFixGuidance(group.rule_id);

 const pendingIds = group.issues.filter((i) => decisionFor(i.id) === null).map((i) => i.id);
 const approvedIds = group.issues.filter((i) => decisionFor(i.id) === "approved").map((i) => i.id);
 const resolvedIds = group.issues.filter((i) => decisionFor(i.id) === "resolved").map((i) => i.id);

 return (
 <div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
 <div className="p-7 space-y-6">
 <div>
 <div className="flex items-center gap-2 mb-3 flex-wrap">
 <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${SEVERITY_PILL[group.severity]} font-semibold tracking-wider`}>
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
 <p className="text-[14px] text-slate-700 leading-relaxed">{ruleDescription}</p>
 )}

 {ruleGuidance && (
 <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3">
 <div className="text-[10px] font-semibold tracking-widest text-indigo-700 mb-1">How we'll fix this</div>
 <p className="text-[13.5px] text-slate-800 leading-relaxed">{ruleGuidance}</p>
 <p className="text-[11.5px] text-slate-500 mt-2">Click any page below for the specific fix on that URL.</p>
 </div>
 )}

 {/* Bulk approval bar */}
 <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
 <div className="text-[12px] text-slate-600 flex items-center gap-1.5 flex-wrap">
 {resolvedIds.length === group.issues.length ? (
 <span className="text-slate-600 font-medium">All pages resolved.</span>
 ) : approvedIds.length === group.issues.length ? (
 <span className="text-emerald-700 font-medium">All pages approved.</span>
 ) : (
 <>
 {approvedIds.length > 0 && (
 <span className="text-emerald-700"><span className="font-medium tabular-nums">{approvedIds.length}</span> approved</span>
 )}
 {approvedIds.length > 0 && pendingIds.length > 0 && (
 <span className="text-slate-300">·</span>
 )}
 {pendingIds.length > 0 && (
 <span><span className="font-medium tabular-nums">{pendingIds.length}</span> pending</span>
 )}
 </>
 )}
 </div>
 <div className="flex items-center gap-2">
 {pendingIds.length > 0 && (
 <button
 onClick={() => decide(pendingIds, "approved")}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-[12.5px] font-medium disabled:opacity-50"
 >
 Approve all {pendingIds.length} {pendingIds.length === 1 ? "page" : "pages"}
 </button>
 )}
 {pendingIds.length > 0 && (
 <button
 onClick={() => decide(pendingIds, "dismissed")}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12.5px] font-medium disabled:opacity-50"
 >
 Dismiss all
 </button>
 )}
 {approvedIds.length > 0 && pendingIds.length === 0 && resolvedIds.length === 0 && (
 <button
 onClick={() => decide(approvedIds, null)}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-900 text-[12.5px] font-medium underline underline-offset-2 disabled:opacity-50"
 >
 Undo approvals
 </button>
 )}
 </div>
 </div>

 <Section label={`Affected pages (${group.issues.length})`}>
 <div className="rounded-lg border border-slate-200/80 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
 {group.issues.map((i) => {
 const d = decisionFor(i.id);
 return (
 <button
 key={i.id}
 onClick={() => onPickIssue(i.id)}
 className={`w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/50 transition-colors group ${d === "dismissed" ? "opacity-50" : ""}`}
 >
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <span className="text-sm text-slate-700 truncate group-hover:text-indigo-800 block">{pageLabel(i.page_url)}</span>
 <span className="text-[11px] text-slate-400 truncate block">{truncate(i.page_url ?? "", 50)}</span>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {d === "approved" && (
 <span className="text-[10px] text-emerald-600 font-medium">✓ approved</span>
 )}
 {d === "resolved" && (
 <span className="text-[10px] text-slate-500 font-medium">✓ resolved</span>
 )}
 {d === "dismissed" && (
 <span className="text-[10px] text-slate-400">dismissed</span>
 )}
 <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100 group-hover:text-indigo-700 whitespace-nowrap px-2.5 py-1 rounded-full ring-1 ring-inset ring-indigo-200/70 transition-colors">
 {i.fix_status === "generated"
 ? "View fix →"
 : i.fix_status === "queued" || i.fix_status === "generating"
 ? "Generating…"
 : i.fix_status === "failed"
 ? "View error →"
 : "Generate fix →"}
 </span>
 </div>
 </div>
 </button>
 );
 })}
 </div>
 </Section>
 </div>
 </div>
 );
}

function IssueDetail({
 issue,
 decisionFor,
 decide,
 submitting,
 token,
 client,
}: {
 issue: AuditIssue;
 decisionFor: (id: string) => IssueDecision;
 decide: (ids: string[], decision: IssueDecision) => Promise<void>;
 submitting: boolean;
 token: string;
 client: Client;
}) {
 const sev = issue.severity as Severity;
 const ev = issue.evidence as { fix_guidance?: string; rule_description?: string; [k: string]: unknown } | null;
 const ruleDescription = ev?.rule_description;
 const evidenceForDisplay = ((): Record<string, unknown> | null => {
 if (!ev || typeof ev !== "object") return null;
 const rest: Record<string, unknown> = { ...ev };
 delete rest.fix_guidance;
 delete rest.rule_description;
 return Object.keys(rest).length > 0 ? rest : null;
 })();
 const decision = decisionFor(issue.id);
 const [showDetails, setShowDetails] = useState(false);

 return (
 <div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
 <div className="p-7 space-y-5">
 {/* 1. Header: severity/category pills, rule name, page URL */}
 <div>
 <div className="flex items-center gap-2 mb-3 flex-wrap">
 <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${SEVERITY_PILL[sev]} font-semibold tracking-wider`}>
 {SEVERITY_LABEL[sev]}
 </span>
 <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/70">
 {CATEGORY_LABEL[issue.category as Category] ?? issue.category}
 </span>
 {decision === "approved" && (
 <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 font-medium">
 ✓ Approved
 </span>
 )}
 {decision === "resolved" && (
 <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70 font-medium">
 ✓ Resolved
 </span>
 )}
 {decision === "dismissed" && (
 <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
 Dismissed
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

 {/* 2. Lead paragraph — plain-English description (what + why) */}
 {ruleDescription && (
 <p className="text-[14px] text-slate-700 leading-relaxed">{ruleDescription}</p>
 )}

 {/* 3. Current vs Proposed — side-by-side, read-only by default */}
 <CurrentVsProposed issue={issue} token={token} />

 {/* 4. Approve / dismiss action bar */}
 <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
 {decision === null && (
 <>
 <span className="text-[12px] text-slate-500">{issue.fix_status === "generated" ? "Review the fix above, then approve when ready to implement." : "Approve to queue this fix for implementation."}</span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => decide([issue.id], "approved")}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-[12.5px] font-medium disabled:opacity-50"
 >
 Approve fix
 </button>
 <button
 onClick={() => decide([issue.id], "dismissed")}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12.5px] font-medium disabled:opacity-50"
 >
 Dismiss
 </button>
 </div>
 </>
 )}
 {decision === "approved" && (
 <>
 <span className="text-[12px] text-emerald-700">Approved — follow the guide below, then mark it resolved.</span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => decide([issue.id], "resolved")}
 disabled={submitting}
 className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-[12.5px] font-medium disabled:opacity-50"
 >
 Mark resolved
 </button>
 <button
 onClick={() => decide([issue.id], null)}
 disabled={submitting}
 className="text-[12.5px] text-slate-500 hover:text-slate-900 underline underline-offset-2 disabled:opacity-50"
 >
 Undo
 </button>
 </div>
 </>
 )}
 {decision === "resolved" && (
 <>
 <span className="text-[12px] text-slate-600 font-medium">✓ Resolved — fix is live.</span>
 <button
 onClick={() => decide([issue.id], "approved")}
 disabled={submitting}
 className="text-[12.5px] text-slate-500 hover:text-slate-900 underline underline-offset-2 disabled:opacity-50"
 >
 Move back to approved
 </button>
 </>
 )}
 {decision === "dismissed" && (
 <>
 <span className="text-[12px] text-slate-500">Dismissed — won't be fixed.</span>
 <button
 onClick={() => decide([issue.id], null)}
 disabled={submitting}
 className="text-[12.5px] text-slate-500 hover:text-slate-900 underline underline-offset-2 disabled:opacity-50"
 >
 Undo
 </button>
 </>
 )}
 </div>

 {/* 5. Implementation guide — shown when fix is generated (before or after approval) */}
 {issue.fix_status === "generated" && issue.proposed_value && (() => {
 const deliverable = deliverableForIssue(issue.rule_id, issue.rule_name);
 if (!deliverable) return null;
 const resolved = resolveGuide(deliverable, client);
 if (resolved.mode === "auto") {
 return (
 <AutoModeNotice
 summary={`We will apply this fix on ${issue.page_url ? (() => { try { return new URL(issue.page_url).hostname; } catch { return "your site"; } })() : "your site"}.`}
 note="You will see confirmation once the fix is live."
 />
 );
 }
 return (
 <ImplementationGuide
 deliverable={deliverable}
 client={client}
 token={token}
 values={{
 page_url: issue.page_url ?? "",
 proposed_value: issue.proposed_value,
 current_value: issue.current_value ?? "",
 }}
 />
 );
 })()}

 {/* 6. Collapsible technical details */}
 <div className="border-t border-slate-100 pt-3">
 <button
 onClick={() => setShowDetails((s) => !s)}
 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
 >
 <svg className={`w-3 h-3 transition-transform ${showDetails ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="9 18 15 12 9 6" />
 </svg>
 Technical details
 </button>
 {showDetails && (
 <div className="mt-3 space-y-4">
 {issue.expected_value && (
 <div>
 <div className="text-[10px] font-semibold tracking-widest text-slate-400 mb-1">What's expected</div>
 <p className="text-[13px] text-slate-700 leading-relaxed">{issue.expected_value}</p>
 </div>
 )}
 {evidenceForDisplay && (
 <div>
 <div className="text-[10px] font-semibold tracking-widest text-slate-400 mb-1">Evidence</div>
 <pre className="font-mono text-[11.5px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-md px-3 py-2 whitespace-pre-wrap break-words overflow-x-auto">
 {JSON.stringify(evidenceForDisplay, null, 2)}
 </pre>
 </div>
 )}
 <div className="text-[11px] text-slate-400 tabular-nums">
 Rule {issue.rule_id} · detected {new Date(issue.detected_at).toLocaleString()}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
 return (
 <div>
 <div className="text-[11px] font-semibold tracking-widest text-slate-400 mb-1.5">{label}</div>
 {children}
 </div>
 );
}

// ─── Current vs Proposed (side-by-side, read-only by default) ─────────

/**
 * Mechanical fixes emit code/markup (HTML tags, nginx blocks, JSON, etc.)
 * which read better in mono. Agentic fixes are mostly prose with small
 * structured blocks — they read better in sans, with the structured part
 * inheriting that font (still legible, less noisy).
 */
function looksLikeCode(value: string): boolean {
 if (!value) return false;
 // HTML/JSON/CSS markers, leading-# config lines, or the section dividers
 // we emit in mechanical-fixes.ts (── ... ── headers).
 return (
 /<\w[^>]*>/.test(value) || // HTML tags
 /[{}][\s\S]*[{}]/.test(value) || // JSON or CSS-like blocks
 /^#\s+\w/m.test(value) || // # nginx, # comment
 /(?:^|\n)\s{2,}\S/m.test(value) || // indented lines (config / pre)
 /location\s*=|return\s+30[12]|RewriteRule|Redirect\s+30[12]/.test(value)
 );
}

function CurrentVsProposed({ issue, token }: { issue: AuditIssue; token: string }) {
 const [draft, setDraft] = useState<string>(issue.proposed_value ?? "");
 const [editing, setEditing] = useState(false);
 const [saving, setSaving] = useState(false);
 const [retrying, setRetrying] = useState(false);
 const [savedAt, setSavedAt] = useState<number | null>(null);

 // Reset on issue change
 useEffect(() => {
 setDraft(issue.proposed_value ?? "");
 setEditing(false);
 setSavedAt(null);
 }, [issue.id, issue.proposed_value]);

 const status = issue.fix_status;
 const current = issue.current_value ?? "—";

 const persist = async () => {
 if (draft === (issue.proposed_value ?? "")) {
 setEditing(false);
 return;
 }
 setSaving(true);
 try {
 const r = await fetch(`/api/portal/audit-edit-fix?token=${encodeURIComponent(token)}`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ issue_id: issue.id, proposed_value: draft }),
 });
 if (r.ok) setSavedAt(Date.now());
 } finally {
 setSaving(false);
 setEditing(false);
 }
 };

 const regenerate = async () => {
 setRetrying(true);
 try {
 await fetch(`/api/portal/audit-regenerate?token=${encodeURIComponent(token)}`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ issue_ids: [issue.id] }),
 });
 } finally {
 setRetrying(false);
 }
 };

 // Render the right-hand "Proposed" cell based on status
 const renderProposed = () => {
 if (status === null) {
 const guidance = getFixGuidance(issue.rule_id);
 return (
 <div className="space-y-2">
 <p className="text-[12px] text-slate-500 italic leading-relaxed">This issue requires a manual fix — no auto-fix is available for this rule.</p>
 <div className="pl-3 border-l-2 border-indigo-200">
 <p className="text-[12px] text-slate-700 leading-relaxed">{guidance}</p>
 </div>
 </div>
 );
 }
 if (status === "queued" || status === "generating") {
 return (
 <div className="flex items-center gap-2 text-[13px] text-slate-600">
 <span className="inline-flex w-3.5 h-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin shrink-0" />
 <span>{status === "queued" ? "Queued…" : "Generating…"}</span>
 </div>
 );
 }
 if (status === "failed") {
 // Long fix_error = agent made a reasoned decision (e.g. "page should be noindexed").
 // Short fix_error = technical failure (HTTP 500, timeout, etc.) — show as error + retry.
 const isAgentDecision = (issue.fix_error?.length ?? 0) > 80;
 if (isAgentDecision) {
 return (
 <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-3 space-y-2">
 <div className="text-[10px] font-semibold tracking-widest text-amber-700">Analysis note</div>
 <p className="text-[12.5px] text-slate-700 leading-relaxed">{issue.fix_error}</p>
 <button
 onClick={regenerate}
 disabled={retrying}
 className="text-[11px] text-slate-400 hover:text-slate-700 underline underline-offset-2 disabled:opacity-50"
 >
 {retrying ? "Retrying…" : "Retry generation"}
 </button>
 </div>
 );
 }
 return (
 <div>
 <p className="text-[12px] text-rose-700 mb-2">
 Generation failed{issue.fix_error ? `: ${issue.fix_error}` : ""}.
 </p>
 <button
 onClick={regenerate}
 disabled={retrying}
 className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[11.5px] font-medium disabled:opacity-50"
 >
 {retrying ? "Retrying…" : "Retry"}
 </button>
 </div>
 );
 }
 // generated
 if (editing) {
 const isMultiline = (draft ?? "").includes("\n") || (draft ?? "").length > 80;
 const editIsCode = looksLikeCode(draft);
 return (
 <div>
 {isMultiline ? (
 <textarea
 value={draft}
 onChange={(e) => setDraft(e.target.value)}
 autoFocus
 className={`w-full bg-white border border-indigo-300 rounded-md px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${editIsCode ? "font-mono text-[12px] text-slate-800" : "font-sans text-[13.5px] text-slate-800"}`}
 rows={Math.min(16, Math.max(4, draft.split("\n").length + 1))}
 spellCheck={!editIsCode}
 />
 ) : (
 <input
 type="text"
 value={draft}
 onChange={(e) => setDraft(e.target.value)}
 autoFocus
 className="w-full text-[13.5px] text-slate-900 bg-white border border-indigo-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
 />
 )}
 <div className="flex items-center gap-2 mt-2">
 <button
 onClick={persist}
 disabled={saving}
 className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11.5px] font-medium disabled:opacity-50"
 >
 {saving ? "Saving…" : "Save"}
 </button>
 <button
 onClick={() => {
 setDraft(issue.proposed_value ?? "");
 setEditing(false);
 }}
 className="text-[11.5px] text-slate-500 hover:text-slate-900"
 >
 Cancel
 </button>
 </div>
 </div>
 );
 }
 // read-only generated
 const proposedIsCode = looksLikeCode(draft);
 return (
 <div>
 <pre className={`whitespace-pre-wrap break-words leading-relaxed ${proposedIsCode ? "font-mono text-[12px] text-slate-800" : "font-sans text-[13.5px] text-slate-800"}`}>
 {draft || "—"}
 </pre>
 {draft && (
 <div className="text-[10px] text-slate-400 mt-1.5 tabular-nums">
 {draft.length} characters
 </div>
 )}
 </div>
 );
 };

 // Right-side action buttons (only when generated + not editing)
 const showRightActions = status === "generated" && !editing;

 return (
 <div className="rounded-lg border border-slate-200/80 overflow-hidden">
 <div className="grid grid-cols-2 divide-x divide-slate-200/80">
 {/* Current */}
 <div className="bg-slate-50/40 px-4 py-3">
 <div className="text-[10px] font-semibold tracking-widest text-slate-500 mb-2">Current</div>
 <pre className={`whitespace-pre-wrap break-words leading-relaxed ${looksLikeCode(current) ? "font-mono text-[12px] text-slate-700" : "font-sans text-[13.5px] text-slate-700"}`}>
 {current}
 </pre>
 </div>
 {/* Proposed */}
 <div className="bg-indigo-50/30 px-4 py-3">
 <div className="flex items-center justify-between gap-2 mb-2">
 <div className="text-[10px] font-semibold tracking-widest text-indigo-700">{status === null ? "How to fix" : "Proposed"}</div>
 {showRightActions && (
 <div className="flex items-center gap-2 text-[10px] text-slate-500">
 {savedAt && <span className="text-emerald-600">Saved</span>}
 <button
 onClick={() => setEditing(true)}
 className="text-slate-500 hover:text-slate-900 underline underline-offset-2"
 >
 Edit
 </button>
 <span className="text-slate-300">·</span>
 <button
 onClick={regenerate}
 disabled={retrying}
 className="text-slate-500 hover:text-slate-900 underline underline-offset-2 disabled:opacity-50"
 >
 {retrying ? "…" : "Regenerate"}
 </button>
 </div>
 )}
 </div>
 {renderProposed()}
 </div>
 </div>
 </div>
 );
}
