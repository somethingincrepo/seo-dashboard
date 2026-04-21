"use client";

import { useState, useEffect, useCallback } from "react";

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

type Client = { id: string; fields: { client_id: string; company_name: string } };

function StatusChip({ status }: { status: IndexingStatus }) {
  if (status === "submitted") {
    return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 font-medium">● Submitted</span>;
  }
  if (status === "failed") {
    return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 font-medium">✕ Failed</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 font-medium">— Not sent</span>;
}

function formatUrl(url: string): string {
  try { return new URL(url).pathname || "/"; } catch { return url; }
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function IndexingAdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [changes, setChanges] = useState<Change[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Load client list
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.clients)) setClients(data.clients);
        else if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {});
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadChanges = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/google-indexing?client_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setChanges(data.changes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) loadChanges(clientId);
    else setChanges([]);
  }, [clientId, loadChanges]);

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = changes.filter((c) => {
    if (seen.has(c.page_url)) return false;
    seen.add(c.page_url);
    return true;
  });

  const allSelected = deduped.length > 0 && deduped.every((c) => selected.has(c.page_url));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deduped.map((c) => c.page_url)));
  const toggleOne = (url: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n; });

  async function handleSubmit() {
    const urls = Array.from(selected);
    if (!urls.length || !clientId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/google-indexing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, urls }),
      });
      const data = await res.json();
      const s = data.succeeded?.length ?? 0;
      const f = data.failed?.length ?? 0;
      setToast({ msg: `${s} submitted${f > 0 ? `, ${f} failed` : ""}${data.quota_warning ? " — near quota limit" : ""}`, ok: f === 0 });
      setChanges((prev) =>
        prev.map((c) => {
          if (data.succeeded?.includes(c.page_url)) return { ...c, indexing_status: "submitted", indexing_submitted_at: new Date().toISOString() };
          if (data.failed?.some((ff: { url: string }) => ff.url === c.page_url)) return { ...c, indexing_status: "failed" };
          return c;
        })
      );
      setSelected(new Set());
    } catch {
      setToast({ msg: "Request failed. Check console.", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  const counts = {
    total: deduped.length,
    submitted: deduped.filter((c) => c.indexing_status === "submitted").length,
    not_submitted: deduped.filter((c) => c.indexing_status === "not_submitted").length,
    failed: deduped.filter((c) => c.indexing_status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Indexing</h1>
        <p className="text-slate-500 text-sm mt-1">Submit implemented pages to the Google Indexing API.</p>
      </div>

      {/* Client selector */}
      <div className="flex items-center gap-3">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 min-w-[240px]"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.fields.client_id || c.id}>
              {c.fields.company_name}
            </option>
          ))}
        </select>
        {clientId && (
          <span className="text-sm text-slate-400">{counts.total} page{counts.total !== 1 ? "s" : ""} · {counts.submitted} submitted · {counts.not_submitted} not sent{counts.failed > 0 ? ` · ${counts.failed} failed` : ""}</span>
        )}
      </div>

      {/* Action bar */}
      {deduped.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300 accent-slate-800" />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Submitting…" : `Submit ${selected.size} to Google`}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!clientId ? (
        <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">Select a client to view their implemented pages.</div>
      ) : loading ? (
        <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">Loading…</div>
      ) : deduped.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">No implemented changes with URLs found for this client.</div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-slate-400">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left font-semibold">URL</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Implemented</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {deduped.map((change, i) => (
                <tr
                  key={change.page_url}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${i > 0 ? "border-t border-slate-100" : ""} ${selected.has(change.page_url) ? "bg-slate-50" : ""}`}
                  onClick={() => toggleOne(change.page_url)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(change.page_url)}
                      onChange={() => toggleOne(change.page_url)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 accent-slate-800"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 max-w-xs truncate" title={change.page_url}>
                    {formatUrl(change.page_url)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{change.cat || change.type}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(change.implemented_at)}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={change.indexing_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${toast.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
