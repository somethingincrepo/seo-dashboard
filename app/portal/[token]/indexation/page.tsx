"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

type IndexingStatus = "not_submitted" | "submitted" | "failed";

type Change = {
  id: string;
  page_url: string;
  type: string;
  cat: string;
  implemented_at: string;
  indexing_status: IndexingStatus;
  indexing_submitted_at: string | null;
  change_title: string;
};

type FilterTab = "all" | "not_submitted" | "submitted" | "failed";

// ─── Status chip ────────────────────────────────────────────────────────────

function StatusChip({ status, submittedAt }: { status: IndexingStatus; submittedAt: string | null }) {
  if (status === "submitted") {
    const date = submittedAt ? new Date(submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        Submitted{date ? ` ${date}` : ""}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
      Not sent
    </span>
  );
}

// ─── Metric tile ────────────────────────────────────────────────────────────

function MetricTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${highlight ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error" | "warning"; onDismiss: () => void }) {
  const colors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${colors[type]}`}>
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 transition-opacity text-xs">✕</button>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function IndexationPage() {
  const params = useParams();
  const token = params.token as string;

  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterTab>("all");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/indexation?token=${token}`);
      const data = await res.json();
      if (data.changes) setChanges(data.changes);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = changes.filter((c) => {
    if (filter === "all") return true;
    return c.indexing_status === filter;
  });

  // Deduplicate URLs so we only show one row per URL
  const seen = new Set<string>();
  const deduped = filtered.filter((c) => {
    if (seen.has(c.page_url)) return false;
    seen.add(c.page_url);
    return true;
  });

  const counts = {
    total: new Set(changes.map((c) => c.page_url)).size,
    submitted: changes.filter((c) => c.indexing_status === "submitted").length,
    not_submitted: changes.filter((c) => c.indexing_status === "not_submitted").length,
    failed: changes.filter((c) => c.indexing_status === "failed").length,
  };

  const allSelected = deduped.length > 0 && deduped.every((c) => selected.has(c.page_url));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deduped.map((c) => c.page_url)));
    }
  }

  function toggleOne(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function handleSubmit() {
    const urls = Array.from(selected);
    if (urls.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/portal/indexation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, urls }),
      });
      const data = await res.json();

      // Optimistically update local state
      setChanges((prev) =>
        prev.map((c) => {
          if (data.succeeded?.includes(c.page_url)) {
            return { ...c, indexing_status: "submitted", indexing_submitted_at: new Date().toISOString() };
          }
          if (data.failed?.some((f: { url: string }) => f.url === c.page_url)) {
            return { ...c, indexing_status: "failed" };
          }
          return c;
        })
      );
      setSelected(new Set());

      const s = data.succeeded?.length ?? 0;
      const f = data.failed?.length ?? 0;

      if (data.quota_warning) {
        setToast({ message: `Submitted ${s} URL${s !== 1 ? "s" : ""}. Note: you're approaching Google's 200/day limit.`, type: "warning" });
      } else if (f === 0) {
        setToast({ message: `${s} URL${s !== 1 ? "s" : ""} sent to Google successfully.`, type: "success" });
      } else if (s === 0) {
        setToast({ message: `Failed to submit ${f} URL${f !== 1 ? "s" : ""}. Try again in a moment.`, type: "error" });
      } else {
        setToast({ message: `${s} submitted, ${f} failed. Check failed items and retry.`, type: "warning" });
      }
    } catch {
      setToast({ message: "Something went wrong. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function formatUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname || "/";
    } catch {
      return url;
    }
  }

  function formatDate(iso: string): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "not_submitted", label: "Not sent" },
    { key: "submitted", label: "Submitted" },
    { key: "failed", label: "Failed" },
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Indexation</h1>
        <p className="text-sm text-slate-500 mt-1">Tell Google about your updated pages so search results stay current.</p>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricTile label="Total pages" value={counts.total} />
        <MetricTile label="Submitted to Google" value={counts.submitted} />
        <MetricTile label="Not yet sent" value={counts.not_submitted} highlight={counts.not_submitted > 0} />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              filter === tab.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.key === "failed" && counts.failed > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{counts.failed}</span>
            )}
            {tab.key === "not_submitted" && counts.not_submitted > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">{counts.not_submitted}</span>
            )}
          </button>
        ))}
      </div>

      {/* Action bar */}
      {deduped.length > 0 && (
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Submitting…
                </>
              ) : (
                <>Submit {selected.size} to Google</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {deduped.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <div className="text-slate-400 text-sm">
            {filter === "all"
              ? "No implemented changes yet. Once our team makes updates to your site they'll appear here."
              : `No ${filter === "not_submitted" ? "unsubmitted" : filter} pages.`}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {deduped.map((change, i) => (
            <div
              key={change.page_url}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                i > 0 ? "border-t border-slate-100" : ""
              } ${selected.has(change.page_url) ? "bg-slate-50" : ""}`}
              onClick={() => toggleOne(change.page_url)}
            >
              <input
                type="checkbox"
                checked={selected.has(change.page_url)}
                onChange={() => toggleOne(change.page_url)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-slate-300 accent-slate-800 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate" title={change.page_url}>
                  {formatUrl(change.page_url)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-400">{change.cat || change.type}</span>
                  {change.implemented_at && (
                    <>
                      <span className="text-slate-200">·</span>
                      <span className="text-[11px] text-slate-400">Updated {formatDate(change.implemented_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <StatusChip status={change.indexing_status} submittedAt={change.indexing_submitted_at} />
              </div>
              {change.indexing_status === "failed" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(new Set([change.page_url]));
                  }}
                  className="shrink-0 text-[11px] text-red-500 hover:text-red-700 underline transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Explainer callout */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 flex gap-3">
        <div className="text-blue-400 text-lg shrink-0 mt-0.5">💡</div>
        <div>
          <div className="text-[13px] font-semibold text-blue-800 mb-1">What is indexing?</div>
          <p className="text-[13px] text-blue-700 leading-relaxed">
            When we update your site — new content, improved titles, technical fixes — Google needs to be told so it re-reads your pages and updates your search results. Submitting here sends that signal directly, which can speed up when you see improvements in Google Search.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
