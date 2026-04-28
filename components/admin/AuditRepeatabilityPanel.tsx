"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AuditRunSummary, AuditIssue } from "@/lib/audit/queries";

interface Props {
  run: AuditRunSummary;
  priorRuns: AuditRunSummary[];
  currentIssues: AuditIssue[];
}

/**
 * Admin-only QA tool. Triggers a fresh audit for the same client, then on the
 * follow-up render compares the two runs' issue lists. Diff should be zero —
 * any non-zero diff means the deterministic engine has a bug.
 */
export function AuditRepeatabilityPanel({ run, priorRuns, currentIssues }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparedRunId, setComparedRunId] = useState<string | null>(priorRuns[0]?.id ?? null);

  const compared = priorRuns.find((r) => r.id === comparedRunId) ?? null;

  const onRunAgain = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: run.client_id, root_url: run.root_url }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${resp.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Repeatability test</div>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Two consecutive runs on the same site should produce an identical issue list. Any diff means the engine
            isn't deterministic — investigate before shipping.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {priorRuns.length > 0 && (
            <select
              value={comparedRunId ?? ""}
              onChange={(e) => setComparedRunId(e.target.value)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
            >
              <option value="">Compare against prior run…</option>
              {priorRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleString()} ({r.issues_found} issues)
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onRunAgain}
            disabled={submitting}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Triggering…" : "Run again now"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200/70 rounded-md px-3 py-2">{error}</div>
      )}

      {compared && (
        <ComparePanel
          a={run}
          aIssues={currentIssues}
          b={compared}
        />
      )}
    </div>
  );
}

function ComparePanel({
  a,
  aIssues,
  b,
}: {
  a: AuditRunSummary;
  aIssues: AuditIssue[];
  b: AuditRunSummary;
}) {
  const [bIssues, setBIssues] = useState<AuditIssue[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (bIssues) return;
    setLoading(true);
    setErr(null);
    try {
      // Hit a tiny lightweight endpoint that returns issues for a given run.
      const resp = await fetch(`/api/audit/issues?run=${b.id}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = (await resp.json()) as { issues: AuditIssue[] };
      setBIssues(j.issues);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const diff = useMemo(() => {
    if (!bIssues) return null;
    const fp = (i: AuditIssue) => `${i.rule_id}::${i.scope}::${i.page_url ?? ""}::${i.current_value ?? ""}`;
    const aSet = new Set(aIssues.map(fp));
    const bSet = new Set(bIssues.map(fp));
    const onlyInA: string[] = [];
    const onlyInB: string[] = [];
    for (const f of aSet) if (!bSet.has(f)) onlyInA.push(f);
    for (const f of bSet) if (!aSet.has(f)) onlyInB.push(f);
    return { onlyInA, onlyInB, identical: onlyInA.length === 0 && onlyInB.length === 0 };
  }, [aIssues, bIssues]);

  return (
    <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50/50">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-600">
          Comparing this run against{" "}
          <Link href={`/audit/${b.id}`} className="text-indigo-700 hover:underline">
            run from {new Date(b.created_at).toLocaleString()}
          </Link>
        </div>
        {!bIssues && (
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Compare"}
          </button>
        )}
      </div>

      {err && <div className="text-xs text-rose-700 mt-2">{err}</div>}

      {bIssues && diff && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="This run" value={`${a.pages_crawled} pages, ${aIssues.length} issues`} />
            <Stat label="Prior run" value={`${b.pages_crawled} pages, ${bIssues.length} issues`} />
            <Stat
              label="Diff"
              value={diff.identical ? "0 (identical)" : `${diff.onlyInA.length + diff.onlyInB.length}`}
              tone={diff.identical ? "good" : "bad"}
            />
          </div>

          {!diff.identical && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <DiffList title={`Only in this run (${diff.onlyInA.length})`} items={diff.onlyInA} />
              <DiffList title={`Only in prior run (${diff.onlyInB.length})`} items={diff.onlyInB} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/80 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
      <div
        className={`text-sm font-semibold tabular-nums mt-0.5 ${
          tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DiffList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/80 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{title}</div>
      <div className="font-mono text-[11px] text-slate-600 max-h-40 overflow-y-auto space-y-0.5">
        {items.length === 0 && <div className="text-slate-400 italic">none</div>}
        {items.slice(0, 50).map((s, i) => (
          <div key={i} className="truncate" title={s}>{s}</div>
        ))}
        {items.length > 50 && <div className="text-slate-400">… and {items.length - 50} more</div>}
      </div>
    </div>
  );
}
