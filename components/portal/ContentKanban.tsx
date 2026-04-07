"use client";

import { useState, useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { approveContentJob, approveContentResult, type ContentJob, type ContentResult } from "@/lib/content";

type KanbanColumn = {
  key: string;
  label: string;
  countColor: string;
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

export function ContentKanban({ jobs, results, token }: ContentKanbanProps) {
  const [selectedJob, setSelectedJob] = useState<ContentJob | null>(null);
  const [selectedResult, setSelectedResult] = useState<ContentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [locallyDecided, setLocallyDecided] = useState<Set<string>>(new Set());

  const liveJobs = jobs.filter((j) => !locallyDecided.has(j.id));

  const columns: KanbanColumn[] = [
    {
      key: "titled",
      label: "Titles Proposed",
      countColor: "text-blue-600",
      gradientStyle: "linear-gradient(90deg, #3B82F6, #93C5FD)",
      jobs: liveJobs.filter((j) => j.fields.title_status === "titled"),
    },
    {
      key: "approved",
      label: "Approved",
      countColor: "text-emerald-600",
      gradientStyle: "linear-gradient(90deg, #10B981, #6EE7B7)",
      jobs: liveJobs.filter((j) => j.fields.title_status === "approved"),
    },
    {
      key: "generating",
      label: "In Progress",
      countColor: "text-amber-600",
      gradientStyle: "linear-gradient(90deg, #F59E0B, #FCD34D)",
      jobs: liveJobs.filter((j) =>
        j.fields.title_status === "generating" ||
        (j.fields.Status === "In Progress" && j.fields.title_status !== "completed" && j.fields.title_status !== "published")
      ),
    },
    {
      key: "completed",
      label: "Ready for Review",
      countColor: "text-indigo-600",
      gradientStyle: "linear-gradient(90deg, #4F46E5, #818CF8)",
      jobs: liveJobs.filter((j) => j.fields.title_status === "completed" || (j.fields.Status === "Completed" && !j.fields.title_status)),
    },
    {
      key: "published",
      label: "Published",
      countColor: "text-teal-600",
      gradientStyle: "linear-gradient(90deg, #0D9488, #5EEAD4)",
      jobs: liveJobs.filter((j) => j.fields.title_status === "published"),
    },
  ];

  const handleJobAction = useCallback(async (jobId: string, action: "approved" | "skipped") => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await approveContentJob(jobId, action);
      setLocallyDecided((prev) => new Set(prev).add(jobId));
      setFeedback({ type: "success", message: action === "approved" ? "Title approved — content generation will begin" : "Title skipped" });
      setTimeout(() => { setFeedback(null); setSelectedJob(null); }, 1500);
    } catch (e) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleResultAction = useCallback(async (resultId: string, action: "approved" | "needs_revision") => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await approveContentResult(resultId, action);
      setLocallyDecided((prev) => new Set(prev).add(resultId));
      setFeedback({ type: "success", message: action === "approved" ? "Article approved" : "Revision requested" });
      setTimeout(() => { setFeedback(null); setSelectedResult(null); }, 1500);
    } catch (e) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  }, []);

  const findResultForJob = (job: ContentJob): ContentResult | undefined => {
    return results.find((r) => r.fields["Blog Title"] === job.fields["Blog Title"]);
  };

  const openJobDetail = (job: ContentJob) => {
    setSelectedJob(job);
    setSelectedResult(null);
    setFeedback(null);
  };

  return (
    <div className="relative">
      {/* Kanban grid */}
      <div className="grid grid-cols-5 gap-3 flex-1">
        {columns.map((col) => (
          <div key={col.key} className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 flex flex-col overflow-hidden min-h-[200px]" style={{ boxShadow: "var(--shadow-xs)" }}>
            {/* Gradient stripe */}
            <div className="h-[3px] w-full shrink-0" style={{ background: col.gradientStyle }} />
            <div className="p-3 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {col.label}
                </span>
                <span className={`text-xs font-bold tabular ${col.countColor}`}>
                  {col.jobs.length}
                </span>
              </div>

              {col.jobs.length === 0 ? (
                <div className="text-xs text-slate-300 py-6 text-center flex-1">—</div>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {col.jobs.slice(0, 8).map((job) => {
                    const hasResult = job.fields.Status === "Completed" || job.fields.title_status === "completed";
                    return (
                      <div
                        key={job.id}
                        onClick={() => openJobDetail(job)}
                        className={`rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 group border ${
                          selectedJob?.id === job.id
                            ? "bg-indigo-50 border-indigo-300 shadow-[var(--shadow-xs)]"
                            : "bg-white border-slate-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 line-clamp-2 leading-snug">
                          {job.fields["Blog Title"]}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {job.fields.target_keyword && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {job.fields.target_keyword}
                            </span>
                          )}
                          {hasResult && (
                            <span className="text-[10px] text-indigo-400">
                              {job.fields["Desired length range"] || ""}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {col.jobs.length > 8 && (
                    <div className="text-[10px] text-slate-400 text-center py-1">
                      +{col.jobs.length - 8} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Drawer Overlay ── */}
      {(selectedJob || selectedResult) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setSelectedJob(null);
            setSelectedResult(null);
            setFeedback(null);
          }}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-[480px] bg-white border-l border-slate-200 flex flex-col transition-transform duration-200 ease-out"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-0">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedJob && (
                  <StatusBadge value={getStatusLabel(selectedJob.fields.title_status)} variant="job_status" />
                )}
                {selectedResult && (
                  <StatusBadge value="Completed" variant="job_status" />
                )}
              </div>
              <button
                onClick={() => { setSelectedJob(null); setSelectedResult(null); setFeedback(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none ml-3 mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 pb-28">
              {selectedJob && (() => {
                const result = findResultForJob(selectedJob);

                return (
                  <div className="space-y-6">
                    {/* Title */}
                    <h2 className="text-xl font-bold text-slate-900 mt-3 leading-snug">
                      {selectedJob.fields["Blog Title"]}
                    </h2>

                    {/* Title metadata */}
                    {selectedJob.fields.target_keyword && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                          {selectedJob.fields.target_keyword}
                        </span>
                        {selectedJob.fields.keyword_group && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                            {selectedJob.fields.keyword_group}
                          </span>
                        )}
                        {selectedJob.fields["Search intent"] && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                            {selectedJob.fields["Search intent"]}
                          </span>
                        )}
                        {selectedJob.fields["Target persona"] && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                            {selectedJob.fields["Target persona"]}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Content angle */}
                    {selectedJob.fields.content_angle && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                          Content Angle
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed italic">
                          {selectedJob.fields.content_angle}
                        </p>
                      </div>
                    )}

                    {/* Article preview (if result exists) */}
                    {result && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                          Article Preview
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 max-h-[500px] overflow-y-auto">
                          <div
                            className="prose prose-slate prose-sm max-w-none
                              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4
                              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-6 [&_h2]:mb-3
                              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-2
                              [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-3
                              [&_ul]:text-slate-600 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5
                              [&_ol]:text-slate-600 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5
                              [&_li]:mb-1
                              [&_strong]:text-slate-800 [&_strong]:font-semibold
                              [&_em]:text-slate-500
                              [&_a]:text-indigo-600 [&_a]:hover:text-indigo-700
                              [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-500
                              [&_code]:text-sm [&_code]:bg-slate-100 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-slate-700
                              [&_pre]:bg-slate-100 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto
                              [&_pre_code]:bg-transparent [&_pre_code]:p-0
                              [&_hr]:border-slate-200 [&_hr]:my-6
                              [&_img]:rounded-lg [&_img]:my-4
                            "
                            dangerouslySetInnerHTML={{ __html: result.fields.Body }}
                          />
                        </div>
                      </div>
                    )}

                    {/* SEO Metadata (if result exists) */}
                    {result && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                          SEO Metadata
                        </div>
                        <div className="space-y-2">
                          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                            <div className="text-[11px] text-slate-400 mb-1">Meta Title ({(result.fields["Meta Title"] || "").length} chars)</div>
                            <div className="text-sm text-slate-700">{result.fields["Meta Title"] || "—"}</div>
                          </div>
                          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                            <div className="text-[11px] text-slate-400 mb-1">Meta Description ({(result.fields["Meta Description"] || "").length} chars)</div>
                            <div className="text-sm text-slate-700">{result.fields["Meta Description"] || "—"}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                      <div className={`text-sm px-3 py-2 rounded-lg ${
                        feedback.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
                      }`}>
                        {feedback.message}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Sticky action bar */}
            {(selectedJob) && (() => {
              const result = findResultForJob(selectedJob);
              const isTitlePhase = !result && selectedJob.fields.title_status === "titled";
              const isReviewPhase = result && (!selectedJob.fields.title_status || selectedJob.fields.title_status === "completed");

              return (
                <div className="absolute bottom-0 left-0 right-0 pt-4 pb-4 px-6 bg-gradient-to-t from-white via-white/95 to-transparent">
                  {isTitlePhase && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleJobAction(selectedJob.id, "approved")}
                        disabled={submitting}
                        className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        Approve Title
                      </button>
                      <button
                        onClick={() => handleJobAction(selectedJob.id, "skipped")}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {isReviewPhase && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResultAction(result.id, "approved")}
                        disabled={submitting}
                        className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        Approve Article
                      </button>
                      <button
                        onClick={() => handleResultAction(result.id, "needs_revision")}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                      >
                        Skip
                      </button>
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
