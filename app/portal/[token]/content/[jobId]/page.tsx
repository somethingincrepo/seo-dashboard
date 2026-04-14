"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentJob, ContentResult } from "@/lib/content";

// ── Bracket-to-HTML converter ────────────────────────────────────────────────
function bracketToHtml(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { out.push(""); continue; }
    const inlined = line
      .replace(/\[B\]/g, "<strong>").replace(/\[\/B\]/g, "</strong>")
      .replace(/\[LI\]\s*(.*?)\[\/LI\]/g, "<li>$1</li>")
      .replace(/\[LI\]\s*(.*)/g, "<li>$1</li>");
    const mapped = inlined
      .replace(/^\[H1\]\s*(.*)/, "<h1>$1</h1>")
      .replace(/^\[H2\]\s*(.*)/, "<h2>$1</h2>")
      .replace(/^\[H3\]\s*(.*)/, "<h3>$1</h3>")
      .replace(/^\[P\]\s*(.*)/, "<p>$1</p>")
      .replace(/^\[UL\]/, "<ul>").replace(/^\[\/UL\]/, "</ul>")
      .replace(/^\[\/H[123]\]$/, "").replace(/^\[\/P\]$/, "");
    out.push(mapped);
  }
  return out.join("\n");
}

export default function ArticleReviewPage() {
  const params = useParams<{ token: string; jobId: string }>();
  const router = useRouter();
  const { token, jobId } = params;

  const [job, setJob] = useState<ContentJob | null>(null);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/portal/content-review/article?token=${token}&jobId=${jobId}`);
      if (res.ok) {
        const data = await res.json() as { job: ContentJob; result: ContentResult | null };
        setJob(data.job);
        setResult(data.result);
      }
      setLoading(false);
    }
    void load();
  }, [token, jobId]);

  const handleApprove = useCallback(async () => {
    if (!result) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/content-review?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "approve_article", resultId: result.id }),
      });
      if (!res.ok) throw new Error("Failed");
      setFeedback({ type: "success", message: "Article approved — we'll publish it as a draft shortly." });
      setResult((r) => r ? { ...r, fields: { ...r.fields, portal_approval: "approved" } } : r);
    } catch {
      setFeedback({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }, [result, token]);

  const handleRevise = useCallback(async () => {
    if (!result) return;
    if (!notes.trim()) {
      setFeedback({ type: "error", message: "Please describe what needs to be changed." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/content-review?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "revise_article", resultId: result.id, notes: notes.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setFeedback({ type: "success", message: "Revision request sent. We'll update the article and notify you." });
      setResult((r) => r ? { ...r, fields: { ...r.fields, portal_approval: "needs_revision" } } : r);
    } catch {
      setFeedback({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }, [result, notes, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm">Loading article…</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm">Article not found.</div>
      </div>
    );
  }

  const approval = result?.fields.portal_approval;
  const hasDecision = !!approval;
  const docUrl = result?.fields.DocumentUrl;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          href={`/portal/${token}/content`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to pipeline
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {job.fields["Blog Title"]}
            </h1>
            {job.fields.target_keyword && (
              <p className="text-sm text-slate-500 mt-1">
                Target keyword: <span className="font-medium text-slate-700">{job.fields.target_keyword}</span>
              </p>
            )}
          </div>

          {/* Status badge */}
          {hasDecision && (
            <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              approval === "approved"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              {approval === "approved" ? "✓ Approved" : "↩ Revision Requested"}
            </div>
          )}
        </div>

        {/* External links row */}
        {docUrl && (
          <div className="mt-3 flex items-center gap-3">
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
              </svg>
              Open in Google Doc
            </a>
          </div>
        )}
      </div>

      {!result ? (
        /* Article still generating */
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-12 text-center">
          <div className="text-3xl mb-3 text-slate-300">◆</div>
          <div className="font-medium text-slate-500 mb-1">Article is being written</div>
          <div className="text-sm text-slate-400">Check back in a few minutes — generation takes about 10 minutes.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SEO Metadata card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">SEO Metadata</h2>
            <div className="grid grid-cols-1 gap-4">
              {result.fields["Meta title"] && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">
                    Meta Title <span className="text-slate-300">·</span> {result.fields["Meta title"].length} chars
                  </div>
                  <p className="text-sm text-slate-800 font-medium">{result.fields["Meta title"]}</p>
                </div>
              )}
              {result.fields["Meta description"] && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">
                    Meta Description <span className="text-slate-300">·</span> {result.fields["Meta description"].length} chars
                  </div>
                  <p className="text-sm text-slate-700">{result.fields["Meta description"]}</p>
                </div>
              )}
              {result.fields["URL slug"] && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">URL Slug</div>
                  <p className="text-sm font-mono text-slate-600">/{result.fields["URL slug"]}</p>
                </div>
              )}
            </div>
          </div>

          {/* Article body */}
          {result.fields["Article body"] && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-6">Article</h2>
              <div
                className="prose prose-slate max-w-none
                  [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4 [&_h1]:mt-0
                  [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-8 [&_h2]:mb-3
                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4
                  [&_ul]:text-slate-600 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5
                  [&_ol]:text-slate-600 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5
                  [&_li]:mb-1.5 [&_strong]:text-slate-800 [&_strong]:font-semibold
                  [&_a]:text-indigo-600 [&_a]:hover:text-indigo-700"
                dangerouslySetInnerHTML={{ __html: bracketToHtml(result.fields["Article body"]) }}
              />
            </div>
          )}

          {/* Review action area */}
          {!hasDecision && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Your Review</h2>

              {/* Notes textarea — always visible, required for revision */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notes for revision <span className="text-slate-400 font-normal">(required if requesting changes)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what needs to be changed — tone, facts, structure, length, etc."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 resize-none"
                />
              </div>

              {feedback && (
                <div className={`text-sm px-4 py-3 rounded-xl border mb-4 ${
                  feedback.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  {feedback.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => void handleApprove()}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Approve Article"}
                </button>
                <button
                  onClick={() => void handleRevise()}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Request Revisions
                </button>
              </div>
            </div>
          )}

          {/* Already decided */}
          {hasDecision && (
            <div className={`rounded-2xl border p-5 ${
              approval === "approved"
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              {approval === "approved" ? (
                <p className="text-sm font-medium text-emerald-800">
                  ✓ You approved this article. We&apos;ll publish it as a WordPress draft shortly.
                </p>
              ) : (
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">↩ Revision requested.</p>
                  {result.fields.portal_notes && (
                    <p className="text-sm text-amber-700 italic">&ldquo;{result.fields.portal_notes}&rdquo;</p>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setFeedback(null);
                  setResult((r) => r ? { ...r, fields: { ...r.fields, portal_approval: null } } : r);
                }}
                className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
              >
                Change decision
              </button>
            </div>
          )}

          {/* Feedback after re-submit from "change decision" */}
          {feedback && hasDecision && (
            <div className={`text-sm px-4 py-3 rounded-xl border ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {feedback.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
