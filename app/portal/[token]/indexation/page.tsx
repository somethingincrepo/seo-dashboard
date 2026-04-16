"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { coverageStateToDisplay, isStale, type GscDisplayStatus } from "@/lib/tools/gsc-inspection";

// ─── Types ────────────────────────────────────────────────────────────────────

type Change = {
  id: string;
  page_url: string;
  type: string;
  cat: string;
  implemented_at: string;
  indexing_status: string;
  indexing_submitted_at: string | null;
  change_title: string;
  gsc_coverage_state: string | null;
  gsc_verdict: string | null;
  gsc_last_checked: string | null;
  gsc_last_crawled: string | null;
};

type Row = {
  url: string;
  cat: string;
  implemented_at: string;
  indexing_status: string;
  indexing_submitted_at: string | null;
  gsc_coverage_state: string | null;
  gsc_verdict: string | null;
  gsc_last_checked: string | null;
  gsc_last_crawled: string | null;
  checking: boolean; // live: currently being inspected
};

type FilterTab = "all" | "indexed" | "issues" | "unchecked";

// ─── GSC status chip ─────────────────────────────────────────────────────────

function GscChip({
  coverageState,
  verdict,
  lastCrawled,
  checking,
}: {
  coverageState: string | null;
  verdict: string | null;
  lastCrawled: string | null;
  checking: boolean;
}) {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
        <svg className="w-2.5 h-2.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Checking…
      </span>
    );
  }

  const display = coverageStateToDisplay(coverageState, verdict as "PASS" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED" | null | undefined);

  if (display === "unchecked") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
        Not checked
      </span>
    );
  }

  if (display === "indexed") {
    const crawled = lastCrawled ? new Date(lastCrawled).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Indexed{crawled ? ` · ${crawled}` : ""}
      </span>
    );
  }

  if (display === "not_indexed" || display === "discovered") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        {display === "discovered" ? "Queued" : "Not indexed"}
      </span>
    );
  }

  if (display === "blocked" || display === "unknown") {
    const label =
      coverageState?.includes("noindex") ? "Blocked: noindex" :
      coverageState?.includes("robots") ? "Blocked: robots" :
      display === "unknown" ? "Not found" : "Blocked";
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        {label}
      </span>
    );
  }

  return null;
}

// ─── Submission chip ──────────────────────────────────────────────────────────

function SubmittedChip({ status, submittedAt }: { status: string; submittedAt: string | null }) {
  if (status === "submitted") {
    const date = submittedAt ? new Date(submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200">
        ✓{date ? ` ${date}` : ""}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-200">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
      —
    </span>
  );
}

// ─── Metric tile ──────────────────────────────────────────────────────────────

function Tile({ label, value, color = "slate", sub }: { label: string; value: number; color?: "slate" | "green" | "amber" | "red"; sub?: string }) {
  const palettes = {
    slate: "bg-white border-slate-200 text-slate-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red:   "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${palettes[color]}`}>
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error" | "warning"; onDismiss: () => void }) {
  const c = { success: "bg-emerald-50 border-emerald-200 text-emerald-800", error: "bg-red-50 border-red-200 text-red-800", warning: "bg-amber-50 border-amber-200 text-amber-800" };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${c[type]}`}>
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 text-xs">✕</button>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IndexationPage() {
  const params = useParams();
  const token = params.token as string;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterTab>("all");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [hasGsc, setHasGsc] = useState(true);
  const autoInspectRan = useRef(false);

  // Build deduplicated rows from Change records
  function buildRows(changes: Change[], checkingUrls: Set<string> = new Set()): Row[] {
    const seen = new Set<string>();
    const result: Row[] = [];
    for (const c of changes) {
      if (!c.page_url || seen.has(c.page_url)) continue;
      seen.add(c.page_url);
      result.push({
        url: c.page_url,
        cat: c.cat || c.type,
        implemented_at: c.implemented_at,
        indexing_status: c.indexing_status || "not_submitted",
        indexing_submitted_at: c.indexing_submitted_at,
        gsc_coverage_state: c.gsc_coverage_state,
        gsc_verdict: c.gsc_verdict,
        gsc_last_checked: c.gsc_last_checked,
        gsc_last_crawled: c.gsc_last_crawled,
        checking: checkingUrls.has(c.page_url),
      });
    }
    return result;
  }

  // Patch GSC data into rows after inspection
  function applyInspectionResults(
    prev: Row[],
    results: Array<{ url: string; coverageState: string; verdict: string; lastCrawlTime: string | null }>
  ): Row[] {
    const map = new Map(results.map((r) => [r.url, r]));
    return prev.map((row) => {
      const r = map.get(row.url);
      if (!r) return { ...row, checking: false };
      return {
        ...row,
        checking: false,
        gsc_coverage_state: r.coverageState,
        gsc_verdict: r.verdict,
        gsc_last_checked: new Date().toISOString(),
        gsc_last_crawled: r.lastCrawlTime,
      };
    });
  }

  // Initial load
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/indexation?token=${token}`);
      const data = await res.json();
      if (data.changes) setRows(buildRows(data.changes));
      if (!data.gsc_property) setHasGsc(false);
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Auto-inspect stale URLs once after initial load
  useEffect(() => {
    if (loading || autoInspectRan.current || !hasGsc || rows.length === 0) return;
    autoInspectRan.current = true;

    const staleUrls = rows.filter((r) => isStale(r.gsc_last_checked)).map((r) => r.url);
    if (staleUrls.length === 0) return;

    // Mark stale rows as "checking" immediately
    setRows((prev) =>
      prev.map((r) => staleUrls.includes(r.url) ? { ...r, checking: true } : r)
    );
    setInspecting(true);

    fetch("/api/portal/indexation/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, urls: staleUrls }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.results?.length > 0) {
          setRows((prev) => applyInspectionResults(prev, data.results));
        } else {
          // Nothing checked (all up to date) — clear checking flags
          setRows((prev) => prev.map((r) => ({ ...r, checking: false })));
        }
      })
      .catch(() => setRows((prev) => prev.map((r) => ({ ...r, checking: false }))))
      .finally(() => setInspecting(false));
  }, [loading, hasGsc, rows.length, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Counts
  const counts = {
    total: rows.length,
    indexed: rows.filter((r) => coverageStateToDisplay(r.gsc_coverage_state, r.gsc_verdict as never) === "indexed").length,
    issues: rows.filter((r) => {
      const d = coverageStateToDisplay(r.gsc_coverage_state, r.gsc_verdict as never);
      return d === "not_indexed" || d === "blocked" || d === "unknown" || d === "discovered";
    }).length,
    unchecked: rows.filter((r) => coverageStateToDisplay(r.gsc_coverage_state, r.gsc_verdict as never) === "unchecked").length,
  };

  // Filtered view
  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    const d = coverageStateToDisplay(r.gsc_coverage_state, r.gsc_verdict as never);
    if (filter === "indexed") return d === "indexed";
    if (filter === "issues") return d === "not_indexed" || d === "blocked" || d === "unknown" || d === "discovered";
    if (filter === "unchecked") return d === "unchecked";
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.url));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.url)));
  const toggleOne = (url: string) => setSelected((prev) => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n; });

  // Submit selected to Google Indexing API
  async function handleSubmit() {
    const urls = Array.from(selected);
    if (!urls.length) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/indexation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, urls }),
      });
      const data = await res.json();

      const now = new Date().toISOString();
      setRows((prev) =>
        prev.map((r) => {
          if (data.succeeded?.includes(r.url)) return { ...r, indexing_status: "submitted", indexing_submitted_at: now };
          if (data.failed?.some((f: { url: string }) => f.url === r.url)) return { ...r, indexing_status: "failed" };
          return r;
        })
      );
      setSelected(new Set());

      const s = data.succeeded?.length ?? 0;
      const f = data.failed?.length ?? 0;
      if (data.quota_warning) setToast({ message: `${s} submitted. Approaching Google's 200/day limit.`, type: "warning" });
      else if (f === 0) setToast({ message: `${s} URL${s !== 1 ? "s" : ""} sent to Google.`, type: "success" });
      else setToast({ message: `${s} submitted, ${f} failed.`, type: f > 0 && s === 0 ? "error" : "warning" });
    } catch {
      setToast({ message: "Something went wrong. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  // Manually refresh a single URL's GSC status
  async function refreshOne(url: string) {
    setRows((prev) => prev.map((r) => r.url === url ? { ...r, checking: true } : r));
    try {
      const res = await fetch("/api/portal/indexation/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, urls: [url], force: true }),
      });
      const data = await res.json();
      if (data.results?.length > 0) {
        setRows((prev) => applyInspectionResults(prev, data.results));
      } else {
        setRows((prev) => prev.map((r) => r.url === url ? { ...r, checking: false } : r));
      }
    } catch {
      setRows((prev) => prev.map((r) => r.url === url ? { ...r, checking: false } : r));
    }
  }

  // Refresh all (force)
  async function refreshAll() {
    if (inspecting) return;
    const urls = rows.map((r) => r.url);
    setRows((prev) => prev.map((r) => ({ ...r, checking: true })));
    setInspecting(true);
    try {
      const res = await fetch("/api/portal/indexation/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, urls, force: true }),
      });
      const data = await res.json();
      if (data.results?.length > 0) {
        setRows((prev) => applyInspectionResults(prev, data.results));
      } else {
        setRows((prev) => prev.map((r) => ({ ...r, checking: false })));
      }
    } catch {
      setRows((prev) => prev.map((r) => ({ ...r, checking: false })));
    } finally {
      setInspecting(false);
    }
  }

  function fmtUrl(url: string) {
    try { return new URL(url).pathname || "/"; } catch { return url; }
  }

  function fmtDate(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All", count: counts.total },
    { key: "indexed", label: "Indexed", count: counts.indexed },
    { key: "issues", label: "Issues", count: counts.issues },
    { key: "unchecked", label: "Not checked", count: counts.unchecked },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Indexation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time Google index status for every page we&apos;ve updated.
            {inspecting && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                <Spinner className="w-3 h-3" />
                Checking with Google…
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={inspecting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          {inspecting ? <Spinner className="w-3.5 h-3.5" /> : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          )}
          Refresh all
        </button>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <Tile label="Total pages" value={counts.total} />
        <Tile label="Indexed" value={counts.indexed} color={counts.indexed > 0 ? "green" : "slate"} sub="confirmed by Google" />
        <Tile label="Issues" value={counts.issues} color={counts.issues > 0 ? "amber" : "slate"} sub="not indexed or blocked" />
        <Tile label="Not checked" value={counts.unchecked} color="slate" sub={hasGsc ? "auto-checks on load" : "no GSC configured"} />
      </div>

      {/* No GSC warning */}
      {!hasGsc && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-[13px] text-amber-800">
          <strong>No Search Console property configured</strong> — Google index status can&apos;t be checked automatically. Contact your account manager to connect GSC.
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              filter === tab.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && filter !== tab.key && (
              <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                tab.key === "issues" ? "bg-amber-100 text-amber-700" :
                tab.key === "indexed" ? "bg-emerald-100 text-emerald-700" :
                "bg-slate-200 text-slate-500"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Action bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-slate-300 accent-slate-800"
            />
            <span className="text-[13px] text-slate-600">
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
          </label>
          {selected.size > 0 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? <><Spinner className="w-3.5 h-3.5" />Submitting…</> : `Submit ${selected.size} to Google`}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-400 text-sm">
          {filter === "all"
            ? "No implemented changes yet. Once our team makes updates to your site they'll appear here."
            : `No ${filter} pages right now.`}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_80px_120px_130px_32px] gap-3 px-4 py-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="w-4" />
            <div>Page</div>
            <div>Changed</div>
            <div>Submitted</div>
            <div>Google status</div>
            <div />
          </div>

          {filtered.map((row, i) => (
            <div
              key={row.url}
              className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_80px_120px_130px_32px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer ${
                i > 0 ? "border-t border-slate-100" : ""
              } ${selected.has(row.url) ? "bg-indigo-50/30" : ""}`}
              onClick={() => toggleOne(row.url)}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(row.url)}
                onChange={() => toggleOne(row.url)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-slate-300 accent-slate-800 shrink-0"
              />

              {/* URL + category */}
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-slate-800 truncate font-mono" title={row.url}>
                  {fmtUrl(row.url)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{row.cat}</div>
              </div>

              {/* Changed date */}
              <div className="hidden sm:block text-[12px] text-slate-500">
                {row.implemented_at ? fmtDate(row.implemented_at) : "—"}
              </div>

              {/* Submitted chip */}
              <div className="hidden sm:block">
                <SubmittedChip status={row.indexing_status} submittedAt={row.indexing_submitted_at} />
              </div>

              {/* GSC status chip */}
              <div className="hidden sm:block">
                <GscChip
                  coverageState={row.gsc_coverage_state}
                  verdict={row.gsc_verdict}
                  lastCrawled={row.gsc_last_crawled}
                  checking={row.checking}
                />
              </div>

              {/* Refresh button */}
              <div className="hidden sm:flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); refreshOne(row.url); }}
                  disabled={row.checking}
                  title="Check Google now"
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
                >
                  {row.checking ? <Spinner className="w-3 h-3" /> : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                  )}
                </button>
              </div>

              {/* Mobile: show both chips inline */}
              <div className="sm:hidden col-span-2 flex items-center gap-2 pl-7 pb-1">
                <SubmittedChip status={row.indexing_status} submittedAt={row.indexing_submitted_at} />
                <GscChip
                  coverageState={row.gsc_coverage_state}
                  verdict={row.gsc_verdict}
                  lastCrawled={row.gsc_last_crawled}
                  checking={row.checking}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Explainer */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 space-y-3">
        <div className="flex gap-3">
          <div className="text-blue-400 shrink-0 mt-0.5">💡</div>
          <div>
            <div className="text-[13px] font-semibold text-blue-800 mb-1">How this works</div>
            <p className="text-[13px] text-blue-700 leading-relaxed">
              When we update your site, we submit each page directly to Google — that&apos;s the <strong>Submitted</strong> column. The <strong>Google status</strong> column shows what Google actually reports back after it visits the page. Most pages show &quot;Indexed&quot; within a few days.
            </p>
          </div>
        </div>
        <div className="pl-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {[
            { chip: "Indexed", color: "bg-emerald-100 text-emerald-700", desc: "Live in Google Search" },
            { chip: "Not indexed", color: "bg-amber-100 text-amber-700", desc: "Google visited but skipped" },
            { chip: "Queued", color: "bg-amber-100 text-amber-700", desc: "Waiting to be crawled" },
            { chip: "Blocked", color: "bg-red-100 text-red-700", desc: "Prevented from indexing" },
          ].map(({ chip, color, desc }) => (
            <div key={chip} className="flex items-start gap-1.5">
              <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${color}`}>{chip}</span>
              <span className="text-blue-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
