"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseJob, JobLog } from "@/lib/supabase";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-slate-300",
  debug: "text-slate-500",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const TERMINAL_STATUS = new Set(["done", "failed"]);

type Props = {
  jobId: string;
  initialJob: SupabaseJob;
  initialLogs: JobLog[];
};

export function LogStream({ jobId, initialJob, initialLogs }: Props) {
  const [job, setJob] = useState<SupabaseJob>(initialJob);
  const [logs, setLogs] = useState<JobLog[]>(initialLogs);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<number>(initialLogs.at(-1)?.id ?? 0);

  useEffect(() => {
    // Auto-scroll to bottom on new logs
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (TERMINAL_STATUS.has(job.status)) return; // stop polling when finished

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/logs?after=${afterRef.current}`);
        if (!res.ok) return;
        const data: { job: SupabaseJob; logs: JobLog[] } = await res.json();
        setJob(data.job);
        if (data.logs.length > 0) {
          afterRef.current = data.logs.at(-1)!.id;
          setLogs((prev) => [...prev, ...data.logs]);
        }
      } catch {
        setError("Polling failed — retrying…");
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, job.status]);

  const duration =
    job.started_at && job.finished_at
      ? Math.round(
          (new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000
        )
      : null;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <StatusPill status={job.status} />
        {job.client_id && (
          <span className="text-slate-500">
            <span className="text-slate-400">client</span> {job.client_id}
          </span>
        )}
        {job.started_at && (
          <span className="text-slate-500">
            <span className="text-slate-400">started</span>{" "}
            {new Date(job.started_at).toLocaleTimeString()}
          </span>
        )}
        {duration !== null && (
          <span className="text-slate-500">
            <span className="text-slate-400">duration</span> {duration}s
          </span>
        )}
        {job.cost_usd > 0 && (
          <span className="text-slate-500">
            <span className="text-slate-400">cost</span> ${job.cost_usd.toFixed(4)}
          </span>
        )}
        {(job.input_tokens > 0 || job.output_tokens > 0) && (
          <span className="text-slate-500">
            <span className="text-slate-400">tokens</span> {job.input_tokens.toLocaleString()} in /{" "}
            {job.output_tokens.toLocaleString()} out
          </span>
        )}
      </div>

      {/* Error */}
      {job.error && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-mono">
          {job.error}
        </div>
      )}

      {/* Log terminal */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            {logs.length} lines
          </span>
          {!TERMINAL_STATUS.has(job.status) && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              live
            </span>
          )}
        </div>
        <div className="p-4 font-mono text-xs overflow-auto max-h-[60vh] space-y-0.5">
          {logs.length === 0 ? (
            <span className="text-slate-600">Waiting for logs…</span>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3 leading-relaxed">
                <span className="text-slate-600 shrink-0 select-none">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 w-10 ${LEVEL_COLOR[log.level] ?? "text-slate-400"}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className="text-slate-200 break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending: "bg-slate-100 text-slate-500",
    claimed: "bg-blue-50 text-blue-600",
    running: "bg-blue-50 text-blue-600",
    done: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${colorMap[status] ?? "bg-slate-100 text-slate-500"}`}
    >
      {status === "running" && (
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
      )}
      {status}
    </span>
  );
}
