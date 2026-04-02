"use client";

import { useState, useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { approveContentJob, approveContentResult, type ContentJob, type ContentResult } from "@/lib/content";

type KanbanColumn = {
  key: string;
  label: string;
  dotColor: string;
  borderColor: string;
  jobs: ContentJob[];
};

interface ContentKanbanProps {
  jobs: ContentJob[];
  results: ContentResult[];
  token: string;
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "titled": return "bg-blue-400/60";
    case "approved": return "bg-emerald-400/60";
    case "skipped": return "bg-slate-400/60";
    case "generating": return "bg-amber-400/60";
    case "completed": return "bg-violet-400/60";
    case "published": return "bg-teal-400/60";
    default: return "bg-white/20";
  }
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
      dotColor: "bg-blue-400",
      borderColor: "border-t-blue-500",
      jobs: liveJobs.filter((j) => j.fields.title_status === "titled"),
    },
    {
      key: "approved",
      label: "Approved",
      dotColor: "bg-emerald-400",
      borderColor: "border-t-emerald-500",
      jobs: liveJobs.filter((j) => j.fields.title_status === "approved"),
    },
    {
      key: "generating",
      label: "In Progress",
      dotColor: "bg-amber-400",
      borderColor: "border-t-amber-500",
      jobs: liveJobs.filter((j) =>
        j.fields.title_status === "generating" ||
        (j.fields.Status === "In Progress" && j.fields.title_status !== "completed" && j.fields.title_status !== "published")
      ),
    },
    {
      key: "completed",
      label: "Ready for Review",
      dotColor: "bg-violet-400",
      borderColor: "border-t-violet-500",
      jobs: liveJobs.filter((j) => j.fields.title_status === "completed" || (j.fields.Status === "Completed" && !j.fields.title_status)),
    },
    {
      key: "published",
      label: "Published",
      dotColor: "bg-teal-400",
      borderColor: "border-t-teal-500",
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
          <div key={col.key} className={`bg-white/[0.03] rounded-2xl p-3 flex flex-col border-t-2 ${col.borderColor} flex-1 min-h-[200px]`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {col.label}
              </span>
              <span className={`text-xs font-bold ${col.dotColor.replace("bg-", "text-").replace("/60", "")}`}>
                {col.jobs.length}
              </span>
            </div>

            {col.jobs.length === 0 ? (
              <div className="text-xs text-white/15 py-6 text-center flex-1">—</div>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto">
                {col.jobs.slice(0, 8).map((job) => {
                  const hasResult = job.fields.Status === "Completed" || job.fields.title_status === "completed";
                  return (
                    <div
                      key={job.id}
                      onClick={() => openJobDetail(job)}
                      className={`bg-white/[0.05] hover:bg-white/[0.08] rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 group ${
                        selectedJob?.id === job.id ? "ring-1 ring-violet-400/40 bg-white/[0.08]" : ""
                      }`}
                    >
                      <div className="text-xs font-semibold text-white/80 group-hover:text-white/95 line-clamp-2 leading-snug">
                        {job.fields["Blog Title"]}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {job.fields.target_keyword && (
                          <span className="text-[10px] text-white/25 truncate max-w-[120px]">
                            {job.fields.target_keyword}
                          </span>
                        )}
                        {hasResult && (
                          <span className="text-[10px] text-violet-400/50">
                            {job.fields["Desired length range"] || ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {col.jobs.length > 8 && (
                  <div className="text-[10px] text-white/20 text-center py-1">
                    +{col.jobs.length - 8} more
                  </div>
                )}
              </div>
            )}
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-[480px] bg-[#0a0a14]/95 backdrop-blur-xl border-l border-white/[0.06] flex flex-col transition-transform duration-200 ease-out"
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
                className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none ml-3 mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 pb-28">
              {selectedJob && (() => {
                const result = findResultForJob(selectedJob);
                const isTitlePhase = !result && selectedJob.fields.title_status === "titled";
                const isReviewPhase = result && (!selectedJob.fields.title_status || selectedJob.fields.title_status === "completed");

                return (
                  <div className="space-y-6">
                    {/* Title */}
                    <h2 className="text-xl font-bold text-white/90 mt-3 leading-snug">
                      {selectedJob.fields["Blog Title"]}
                    </h2>

                    {/* Title metadata */}
                    {selectedJob.fields.target_keyword && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40">
                          {selectedJob.fields.target_keyword}
                        </span>
                        {selectedJob.fields.keyword_group && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40">
                            {selectedJob.fields.keyword_group}
                          </span>
                        )}
                        {selectedJob.fields["Search intent"] && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40">
                            {selectedJob.fields["Search intent"]}
                          </span>
                        )}
                        {selectedJob.fields["Target persona"] && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40">
                            {selectedJob.fields["Target persona"]}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Content angle */}
                    {selectedJob.fields.content_angle && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">
                          Content Angle
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed italic">
                          {selectedJob.fields.content_angle}
                        </p>
                      </div>
                    )}

                    {/* Article preview (if result exists) */}
                    {result && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">
                          Article Preview
                        </div>
                        <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5 max-h-[500px] overflow-y-auto">
                          <div
                            className="prose prose-invert prose-sm max-w-none
                              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white/90 [&_h1]:mb-4
                              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white/85 [&_h2]:mt-6 [&_h2]:mb-3
                              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white/80 [&_h3]:mt-4 [&_h3]:mb-2
                              [&_p]:text-white/60 [&_p]:leading-relaxed [&_p]:mb-3
                              [&_ul]:text-white/60 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5
                              [&_ol]:text-white/60 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5
                              [&_li]:mb-1
                              [&_strong]:text-white/80 [&_strong]:font-semibold
                              [&_em]:text-white/70
                              [&_a]:text-violet-400/80 [&_a]:hover:text-violet-400
                              [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/50
                              [&_code]:text-sm [&_code]:bg-white/[0.06] [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono
                              [&_pre]:bg-white/[0.04] [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto
                              [&_pre_code]:bg-transparent [&_pre_code]:p-0
                              [&_hr]:border-white/[0.06] [&_hr]:my-6
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
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">
                          SEO Metadata
                        </div>
                        <div className="space-y-2">
                          <div className="bg-white/[0.03] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-white/25 mb-1">Meta Title ({(result.fields["Meta Title"] || "").length} chars)</div>
                            <div className="text-sm text-white/70">{result.fields["Meta Title"] || "—"}</div>
                          </div>
                          <div className="bg-white/[0.03] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-white/25 mb-1">Meta Description ({(result.fields["Meta Description"] || "").length} chars)</div>
                            <div className="text-sm text-white/70">{result.fields["Meta Description"] || "—"}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                      <div className={`text-sm px-3 py-2 rounded-lg ${
                        feedback.type === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
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
                <div className="absolute bottom-0 left-0 right-0 pt-4 pb-4 px-6 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14]/95 to-transparent">
                  {isTitlePhase && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleJobAction(selectedJob.id, "approved")}
                        disabled={submitting}
                        className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                      >
                        Approve Title
                      </button>
                      <button
                        onClick={() => handleJobAction(selectedJob.id, "skipped")}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] border border-white/[0.1] text-white/50 hover:bg-white/[0.08] transition-all disabled:opacity-50"
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
                        className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                      >
                        Approve Article
                      </button>
                      <button
                        onClick={() => handleResultAction(result.id, "needs_revision")}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] border border-white/[0.1] text-white/50 hover:bg-white/[0.08] transition-all disabled:opacity-50"
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
