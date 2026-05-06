"use client";

import { useState, useTransition } from "react";

type StuckRow = {
 id: string;
 blogTitle: string;
 clientName: string;
 status: string;
 approvedAt: string | null;
 retryCount: number;
 lastRetryAt: string | null;
 error: string | null;
};

interface Props {
 counts: Record<string, number>;
 stuckOrFailed: StuckRow[];
}

function ageLabel(iso: string | null): string {
 if (!iso) return "—";
 const ageMs = Date.now() - new Date(iso).getTime();
 const m = Math.floor(ageMs / 60_000);
 if (m < 60) return `${m}m`;
 const h = Math.floor(m / 60);
 if (h < 24) return `${h}h`;
 return `${Math.floor(h / 24)}d`;
}

export function ContentJobsPanel({ counts, stuckOrFailed }: Props) {
 const [retrying, setRetrying] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [hidden, setHidden] = useState<Set<string>>(new Set());
 const [, startTransition] = useTransition();

 const onRetry = async (recordId: string) => {
 setError(null);
 setRetrying(recordId);
 try {
 const res = await fetch("/api/admin/content-jobs", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ record_id: recordId }),
 });
 const body = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(body.error ?? `Retry failed (${res.status})`);
 } else {
 startTransition(() => {
 setHidden((prev) => new Set(prev).add(recordId));
 });
 }
 } catch (e) {
 setError(e instanceof Error ? e.message : String(e));
 } finally {
 setRetrying(null);
 }
 };

 const visibleRows = stuckOrFailed.filter((r) => !hidden.has(r.id));
 const statusOrder = ["Queued", "In Progress", "Completed", "Webhook Failed", "Other"];

 return (
 <section className="space-y-3">
 <h2 className="text-sm font-medium text-slate-600 tracking-wider">
 Content Jobs (last 7 days)
 </h2>

 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 {statusOrder.map((s) => {
 const count = counts[s] ?? 0;
 const cls =
 s === "Webhook Failed"
 ? "text-rose-600"
 : s === "Queued"
 ? "text-amber-600"
 : s === "Completed"
 ? "text-emerald-600"
 : s === "In Progress"
 ? "text-blue-600"
 : "text-slate-500";
 return (
 <div key={s} className="rounded-2xl bg-white border border-slate-200/80 p-4 text-center">
 <div className={`text-2xl font-bold ${cls}`}>{count}</div>
 <div className="text-slate-500 text-xs mt-1">{s}</div>
 </div>
 );
 })}
 </div>

 {visibleRows.length === 0 ? (
 <div className="rounded-2xl bg-white border border-slate-200/80 p-6 text-center text-sm text-slate-400">
 No stuck or failed Content Jobs
 </div>
 ) : (
 <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-slate-50 border-b border-slate-200">
 <tr className="text-left text-xs text-slate-500 tracking-wider">
 <th className="px-4 py-2 font-medium">Title</th>
 <th className="px-4 py-2 font-medium">Client</th>
 <th className="px-4 py-2 font-medium">Status</th>
 <th className="px-4 py-2 font-medium">Queued</th>
 <th className="px-4 py-2 font-medium">Retries</th>
 <th className="px-4 py-2 font-medium">Error</th>
 <th className="px-4 py-2 font-medium text-right">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {visibleRows.map((r) => (
 <tr key={r.id} className="hover:bg-slate-50/50">
 <td className="px-4 py-3 max-w-xs truncate" title={r.blogTitle}>{r.blogTitle}</td>
 <td className="px-4 py-3 text-slate-600">{r.clientName}</td>
 <td className="px-4 py-3">
 <span className={`text-xs px-2 py-0.5 rounded-full ${
 r.status === "Webhook Failed"
 ? "bg-rose-50 text-rose-700"
 : "bg-amber-50 text-amber-700"
 }`}>
 {r.status}
 </span>
 </td>
 <td className="px-4 py-3 text-slate-500 tabular-nums">{ageLabel(r.approvedAt)}</td>
 <td className="px-4 py-3 text-slate-500 tabular-nums">{r.retryCount}</td>
 <td className="px-4 py-3 text-xs text-slate-500 max-w-sm truncate" title={r.error ?? ""}>
 {r.error ?? "—"}
 </td>
 <td className="px-4 py-3 text-right">
 <button
 onClick={() => onRetry(r.id)}
 disabled={retrying === r.id}
 className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {retrying === r.id ? "Retrying…" : "Retry now"}
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {error && (
 <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-xs text-rose-700">
 {error}
 </div>
 )}
 </section>
 );
}
