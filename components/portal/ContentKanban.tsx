"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  approveContentJob,
  approveContentResult,
  revertContentJob,
  type ContentJob,
  type ContentResult,
} from "@/lib/content";
import { bracketToHtml } from "@/lib/bracketToHtml";

type KanbanColumn = {
  key: string;
  label: string;
  accent: string;       // Tailwind left-border color class
  headerColor: string;  // label color
  gradientStyle: string;
  jobs: ContentJob[];
};

interface ContentKanbanProps {
  jobs: ContentJob[];
  results: ContentResult[];
  token: string;
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "titled": return "Proposed";
    case "approved": return "Approved";
    case "skipped": return "Skipped";
    case "generating": return "Generating";
    case "completed": return "Ready";
    case "published": return "Published";
    default: return "Unknown";
  }
}

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-50 text-blue-600",
  commercial: "bg-amber-50 text-amber-600",
  transactional: "bg-green-50 text-green-700",
  navigational: "bg-purple-50 text-purple-600",
};

// ── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({
  job,
  selected,
  accent,
  onClick,
  documentUrl,
  token,
}: {
  job: ContentJob;
  selected: boolean;
  accent: string;
  onClick: () => void;
  documentUrl?: string | null;
  token: string;
}) {
  const keyword = job.fields.target_keyword;
  const intent = (job.fields["Search intent"] || "").toLowerCase();
  const angle = job.fields.content_angle;
  const intentClass = INTENT_COLORS[intent] ?? "bg-slate-100 text-slate-500";
  const hasResult = job.fields.Status === "Completed" || job.fields.title_status === "completed";

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-xl border cursor-pointer transition-all duration-150
        ${selected
          ? "bg-indigo-50 border-indigo-300 shadow-md"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5"
        }
      `}
    >
      {/* Column accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${accent}`} />

      <div className="pl-4 pr-3 py-3.5">
        {/* Title */}
        <p className={`text-[13px] font-semibold leading-snug line-clamp-3 mb-2.5 ${selected ? "text-indigo-900" : "text-slate-800 group-hover:text-slate-900"}`}>
          {job.fields["Blog Title"]}
        </p>

        {/* Content angle snippet */}
        {angle && (
          <p className="text-[11px] text-slate-400 italic leading-snug line-clamp-2 mb-2.5">
            {angle}
          </p>
        )}

        {/* Chips row */}
        <div className="flex flex-wrap gap-1">
          {keyword && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium truncate max-w-[140px]">
              {keyword}
            </span>
          )}
          {intent && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${intentClass}`}>
              {intent}
            </span>
          )}
          {hasResult && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 font-medium">
              article ready
            </span>
          )}
        </div>
        {(documentUrl || hasResult) && (
          <div className="mt-2.5 flex flex-col gap-1">
            {documentUrl && (
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
                View Google Doc
              </a>
            )}
            {hasResult && (
              <Link
                href={`/portal/${token}/content/${job.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Review in Portal
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

function ColumnHeader({
  label,
  count,
  headerColor,
  gradientStyle,
}: {
  label: string;
  count: number;
  headerColor: string;
  gradientStyle: string;
}) {
  return (
    <div className="shrink-0">
      <div className="h-[3px] w-full rounded-t-2xl" style={{ background: gradientStyle }} />
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${headerColor}`}>{count}</span>
      </div>
    </div>
  );
}

// ── Content activity feed ─────────────────────────────────────────────────────

type ContentEvent = {
  id: string;
  title: string;
  event: "proposed" | "approved" | "writing" | "ready" | "published";
  date: string;
  keyword?: string;
  job?: ContentJob;
};

const EVENT_CONFIG: Record<ContentEvent["event"], { label: string; dot: string; badge: string }> = {
  proposed:  { label: "Title Proposed",  dot: "bg-slate-300",   badge: "text-slate-500 bg-slate-100 border-slate-200" },
  approved:  { label: "Title Approved",  dot: "bg-emerald-400", badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  writing:   { label: "Writing Started", dot: "bg-amber-400",   badge: "text-amber-700 bg-amber-50 border-amber-200" },
  ready:     { label: "Article Ready",   dot: "bg-indigo-400",  badge: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  published: { label: "Published",       dot: "bg-teal-500",    badge: "text-teal-700 bg-teal-50 border-teal-200" },
};

function formatEventDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function buildContentEvents(jobs: ContentJob[], results: ContentResult[]): ContentEvent[] {
  const events: ContentEvent[] = [];

  for (const job of jobs) {
    const title = job.fields["Blog Title"] || "Untitled";
    const keyword = job.fields.target_keyword || undefined;

    if (job.fields.title_status === "published" && job.fields.approved_at) {
      events.push({ id: `${job.id}-pub`, title, event: "published", date: job.fields.approved_at, keyword, job });
    }
    if (job.fields.Status === "In Progress" || job.fields.title_status === "generating") {
      const d = job.fields.approved_at || job.fields.proposed_at;
      if (d) events.push({ id: `${job.id}-writ`, title, event: "writing", date: d, keyword, job });
    }
    if (job.fields.approved_at) {
      events.push({ id: `${job.id}-app`, title, event: "approved", date: job.fields.approved_at, keyword, job });
    }
    // "proposed" events belong to the Title Proposals section, not the pipeline feed
  }

  for (const result of results) {
    const title = result.fields["Article title"] || "Untitled";
    const d = result.createdTime;
    if (d) events.push({ id: `res-${result.id}`, title, event: "ready", date: d });
  }

  return events
    .filter((e) => !!e.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}

function ContentActivityFeed({
  jobs,
  results,
  onOpen,
}: {
  jobs: ContentJob[];
  results: ContentResult[];
  onOpen: (job: ContentJob) => void;
}) {
  const events = buildContentEvents(jobs, results);

  return (
    <div className="px-10 mt-6 pb-10">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-800">Content Activity</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">A log of every content event across your pipeline</p>
          </div>
          {events.length > 0 && (
            <span className="text-[11px] text-slate-400 tabular-nums">{events.length} events</span>
          )}
        </div>

        {events.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[13px] text-slate-400">No content activity yet</p>
            <p className="text-[11px] text-slate-300 mt-1">Events will appear here as titles are proposed, approved, and written</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Column headers */}
            <div className="grid grid-cols-[140px_1fr_180px_140px] gap-4 px-6 py-2.5 bg-slate-50">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Title</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Keyword</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Event</span>
            </div>

            {events.map((e) => {
              const cfg = EVENT_CONFIG[e.event];
              return (
                <div
                  key={e.id}
                  onClick={() => e.job && onOpen(e.job)}
                  className={`grid grid-cols-[140px_1fr_180px_140px] gap-4 px-6 py-3 items-center ${e.job ? "hover:bg-slate-50 cursor-pointer group" : ""}`}
                >
                  <span className="text-[12px] text-slate-400">{formatEventDate(e.date)}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="text-[13px] text-slate-700 font-medium truncate group-hover:text-slate-900">
                      {e.title}
                    </span>
                  </div>
                  <span className="text-[12px] text-slate-400 truncate">{e.keyword || "—"}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContentKanban({ jobs, results, token }: ContentKanbanProps) {
  const [selectedJob, setSelectedJob] = useState<ContentJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [localUpdates, setLocalUpdates] = useState<Map<string, Partial<ContentJob["fields"]>>>(new Map());

  // Apply local optimistic updates
  const liveJobs = jobs.map((j) => {
    const patch = localUpdates.get(j.id);
    return patch ? { ...j, fields: { ...j.fields, ...patch } } : j;
  });

  // Priority-ordered column assignment
  const isPublished = (j: ContentJob) => j.fields.title_status === "published";
  const isApprovedForPublish = (j: ContentJob) => {
    if (isPublished(j)) return false;
    const result = results.find((r) => r.fields["Job ID"]?.includes(j.id));
    return !!result && result.fields.portal_approval === "approved";
  };
  const isReadyForReview = (j: ContentJob) =>
    !isPublished(j) &&
    !isApprovedForPublish(j) &&
    (j.fields.title_status === "completed" || j.fields.Status === "Completed");
  const isInProgress = (j: ContentJob) =>
    !isPublished(j) &&
    !isApprovedForPublish(j) &&
    !isReadyForReview(j) &&
    (j.fields.title_status === "generating" || j.fields.Status === "In Progress");
  const isApproved = (j: ContentJob) =>
    !isPublished(j) &&
    !isApprovedForPublish(j) &&
    !isReadyForReview(j) &&
    !isInProgress(j) &&
    (j.fields.title_status === "approved" || j.fields.Status === "Queued");
  const isTitled = (j: ContentJob) =>
    !isPublished(j) &&
    !isApprovedForPublish(j) &&
    !isReadyForReview(j) &&
    !isInProgress(j) &&
    !isApproved(j) &&
    j.fields.title_status === "titled";

  const columns: KanbanColumn[] = [
    {
      key: "titled",
      label: "Proposed",
      accent: "bg-slate-300",
      headerColor: "text-slate-500",
      gradientStyle: "linear-gradient(90deg, #94A3B8, #CBD5E1)",
      jobs: liveJobs.filter(isTitled),
    },
    {
      key: "approved",
      label: "Approved",
      accent: "bg-emerald-400",
      headerColor: "text-emerald-600",
      gradientStyle: "linear-gradient(90deg, #10B981, #6EE7B7)",
      jobs: liveJobs.filter(isApproved),
    },
    {
      key: "generating",
      label: "In Progress",
      accent: "bg-amber-400",
      headerColor: "text-amber-600",
      gradientStyle: "linear-gradient(90deg, #F59E0B, #FCD34D)",
      jobs: liveJobs.filter(isInProgress),
    },
    {
      key: "completed",
      label: "Ready for Review",
      accent: "bg-indigo-400",
      headerColor: "text-indigo-600",
      gradientStyle: "linear-gradient(90deg, #4F46E5, #818CF8)",
      jobs: liveJobs.filter(isReadyForReview),
    },
    {
      key: "approved_for_publish",
      label: "Publishing",
      accent: "bg-violet-400",
      headerColor: "text-violet-600",
      gradientStyle: "linear-gradient(90deg, #7C3AED, #A78BFA)",
      jobs: liveJobs.filter(isApprovedForPublish),
    },
    {
      key: "published",
      label: "Published",
      accent: "bg-teal-400",
      headerColor: "text-teal-600",
      gradientStyle: "linear-gradient(90deg, #0D9488, #5EEAD4)",
      jobs: liveJobs.filter(isPublished),
    },
  ];

  const findResultForJob = (job: ContentJob): ContentResult | undefined =>
    results.find((r) => r.fields["Job ID"]?.includes(job.id));

  const openJobDetail = (job: ContentJob) => {
    setSelectedJob(job);
    setFeedback(null);
  };

  const closeDrawer = () => {
    setSelectedJob(null);
    setFeedback(null);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleJobAction = useCallback(async (jobId: string, action: "approved" | "skipped") => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await approveContentJob(jobId, action);
      if (action === "approved") {
        setLocalUpdates((prev) => new Map(prev).set(jobId, { title_status: "approved", Status: "Queued" }));
        setFeedback({ type: "success", message: "Title approved — content generation queued" });
      } else {
        setLocalUpdates((prev) => new Map(prev).set(jobId, { title_status: "skipped" }));
        setFeedback({ type: "success", message: "Title skipped" });
      }
      setTimeout(() => { setFeedback(null); closeDrawer(); }, 1500);
    } catch (e) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRevert = useCallback(async (jobId: string) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await revertContentJob(jobId);
      setLocalUpdates((prev) => new Map(prev).set(jobId, { title_status: "titled", Status: "" }));
      setFeedback({ type: "success", message: "Reverted to proposed" });
      setTimeout(() => { setFeedback(null); closeDrawer(); }, 1200);
    } catch (e) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Failed to revert" });
    } finally {
      setSubmitting(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResultAction = useCallback(async (resultId: string, action: "approved" | "needs_revision") => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await approveContentResult(resultId, action);
      setFeedback({ type: "success", message: action === "approved" ? "Article approved" : "Revision requested" });
      setTimeout(() => { setFeedback(null); closeDrawer(); }, 1500);
    } catch (e) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selected job with live state
  const liveSelectedJob = selectedJob
    ? liveJobs.find((j) => j.id === selectedJob.id) ?? selectedJob
    : null;

  return (
    <div className="relative flex-1">
      {/* Kanban board — horizontal scroll on narrow viewports */}
      <div className="px-10 overflow-x-auto pb-6">
        <div className="flex gap-4 min-w-[900px]">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex-1 min-w-[180px] bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col"
              style={{ minHeight: 420 }}
            >
              <ColumnHeader
                label={col.label}
                count={col.jobs.length}
                headerColor={col.headerColor}
                gradientStyle={col.gradientStyle}
              />

              <div className="flex-1 px-3 pb-3 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
                {col.jobs.length === 0 ? (
                  <div className="text-[11px] text-slate-300 text-center py-8 flex-1 flex items-center justify-center">
                    —
                  </div>
                ) : (
                  col.jobs.slice(0, 20).map((job) => (
                    <KanbanCard
                      key={job.id}
                      job={job}
                      selected={liveSelectedJob?.id === job.id}
                      accent={col.accent}
                      onClick={() => openJobDetail(job)}
                      documentUrl={findResultForJob(job)?.fields.DocumentUrl}
                      token={token}
                    />
                  ))
                )}
                {col.jobs.length > 20 && (
                  <div className="text-[10px] text-slate-400 text-center py-1">
                    +{col.jobs.length - 20} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content Activity Feed ───────────────────────────────────────────── */}
      <ContentActivityFeed jobs={liveJobs} results={results} onOpen={openJobDetail} />

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      {liveSelectedJob && (
        <div className="fixed inset-0 z-40" onClick={closeDrawer}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-[500px] bg-white border-l border-slate-200 flex flex-col"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <StatusBadge
                value={getStatusLabel(liveSelectedJob.fields.title_status)}
                variant="job_status"
              />
              <button
                onClick={closeDrawer}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 pb-32 space-y-5">
              {/* Title */}
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {liveSelectedJob.fields["Blog Title"]}
              </h2>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                {liveSelectedJob.fields.target_keyword && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                    {liveSelectedJob.fields.target_keyword}
                  </span>
                )}
                {liveSelectedJob.fields.keyword_group && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                    {liveSelectedJob.fields.keyword_group}
                  </span>
                )}
                {liveSelectedJob.fields["Search intent"] && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                    {liveSelectedJob.fields["Search intent"]}
                  </span>
                )}
                {liveSelectedJob.fields["Target persona"] && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                    {liveSelectedJob.fields["Target persona"]}
                  </span>
                )}
              </div>

              {/* Content angle */}
              {liveSelectedJob.fields.content_angle && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Content Angle
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-3">
                    {liveSelectedJob.fields.content_angle}
                  </p>
                </div>
              )}

              {/* Article preview */}
              {(() => {
                const result = findResultForJob(liveSelectedJob);
                if (!result) return null;
                return (
                  <>
                    <div className="flex gap-2">
                      {result.fields.DocumentUrl && (
                        <a
                          href={result.fields.DocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
                          View Google Doc
                        </a>
                      )}
                      <Link
                        href={`/portal/${token}/content/${liveSelectedJob.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Review in Portal
                      </Link>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                        Article Preview
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 max-h-[420px] overflow-y-auto">
                        <div
                          className="prose prose-slate prose-sm max-w-none
                            [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4
                            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-6 [&_h2]:mb-3
                            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-2
                            [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-3
                            [&_ul]:text-slate-600 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5
                            [&_ol]:text-slate-600 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5
                            [&_li]:mb-1 [&_strong]:text-slate-800 [&_strong]:font-semibold
                            [&_a]:text-indigo-600 [&_a]:hover:text-indigo-700
                            [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-500
                            [&_code]:text-sm [&_code]:bg-slate-100 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono
                          "
                          dangerouslySetInnerHTML={{ __html: bracketToHtml(result.fields["Article body"] || "") }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                        SEO Metadata
                      </div>
                      <div className="space-y-2">
                        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                          <div className="text-[11px] text-slate-400 mb-1">
                            Meta Title ({(result.fields["Meta title"] || "").length} chars)
                          </div>
                          <div className="text-sm text-slate-700">{result.fields["Meta title"] || "—"}</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                          <div className="text-[11px] text-slate-400 mb-1">
                            Meta Description ({(result.fields["Meta description"] || "").length} chars)
                          </div>
                          <div className="text-sm text-slate-700">{result.fields["Meta description"] || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Feedback */}
              {feedback && (
                <div className={`text-sm px-3 py-2.5 rounded-lg border ${
                  feedback.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  {feedback.message}
                </div>
              )}
            </div>

            {/* ── Sticky action bar ───────────────────────────────────────── */}
            {(() => {
              const result = findResultForJob(liveSelectedJob);
              const isTitlePhase =
                !result &&
                liveSelectedJob.fields.title_status === "titled" &&
                liveSelectedJob.fields.Status !== "In Progress";
              const isApprovedPhase =
                !result &&
                (liveSelectedJob.fields.title_status === "approved" || liveSelectedJob.fields.Status === "Queued") &&
                liveSelectedJob.fields.Status !== "In Progress";
              const isPublishingPhase =
                !!result && result.fields.portal_approval === "approved" &&
                liveSelectedJob.fields.title_status !== "published";
              const isReviewPhase =
                !!result &&
                !isPublishingPhase &&
                (liveSelectedJob.fields.title_status === "completed" || liveSelectedJob.fields.Status === "Completed");

              if (!isTitlePhase && !isApprovedPhase && !isReviewPhase && !isPublishingPhase) return null;

              return (
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent">
                  {isTitlePhase && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => void handleJobAction(liveSelectedJob.id, "approved")}
                        disabled={submitting}
                        className="flex-1 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {submitting ? "Saving…" : "Approve Title"}
                      </button>
                      <button
                        onClick={() => void handleJobAction(liveSelectedJob.id, "skipped")}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                      >
                        Skip
                      </button>
                    </div>
                  )}

                  {isApprovedPhase && (
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-sm font-medium text-emerald-700">Approved — queued for generation</span>
                      </div>
                      <button
                        onClick={() => void handleRevert(liveSelectedJob.id)}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all disabled:opacity-50"
                        title="Move back to Proposed (only available before generation starts)"
                      >
                        {submitting ? "…" : "Revert"}
                      </button>
                    </div>
                  )}

                  {isReviewPhase && result && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => void handleResultAction(result.id, "approved")}
                        disabled={submitting}
                        className="flex-1 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {submitting ? "Saving…" : "Approve for Publishing"}
                      </button>
                    </div>
                  )}

                  {isPublishingPhase && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-50 border border-violet-200">
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
                      <span className="text-sm font-medium text-violet-700">Queued for publishing — going live soon</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
