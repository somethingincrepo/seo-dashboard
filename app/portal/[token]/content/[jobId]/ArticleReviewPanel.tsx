"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type { ContentJob, ContentResult } from "@/lib/content";
import { bracketToHtml } from "@/lib/bracketToHtml";

interface ArticleReviewPanelProps {
  job: ContentJob;
  result: ContentResult | null;
  token: string;
}

export function ArticleReviewPanel({ job, result: initialResult, token }: ArticleReviewPanelProps) {
  const [result, setResult] = useState(initialResult);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Populate editor content when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current && result) {
      editorRef.current.innerHTML = bracketToHtml(result.fields["Article body"] || "");
      editorRef.current.focus();
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!result || !editorRef.current) return;
    const newBody = editorRef.current.innerHTML;
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/content-review?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "save_article_body", resultId: result.id, body: newBody }),
      });
      if (!res.ok) throw new Error("Failed");
      setResult((r) => r ? { ...r, fields: { ...r.fields, "Article body": newBody } } : r);
      setIsEditing(false);
      setFeedback({ type: "success", message: "Changes saved." });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", message: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }, [result, token]);

  const handleApprove = useCallback(async () => {
    if (!result) return;
    setApproving(true);
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
      setApproving(false);
    }
  }, [result, token]);

  const approval = result?.fields.portal_approval;
  const isApproved = approval === "approved";
  const docUrl = result?.fields.DocumentUrl;
  const articleHtml = bracketToHtml(result?.fields["Article body"] || "");

  const proseClasses = `prose prose-slate max-w-none
    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4 [&_h1]:mt-0
    [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-8 [&_h2]:mb-3
    [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-6 [&_h3]:mb-2
    [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4
    [&_ul]:text-slate-600 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5
    [&_ol]:text-slate-600 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5
    [&_li]:mb-1.5 [&_strong]:text-slate-800 [&_strong]:font-semibold
    [&_a]:text-indigo-600 [&_a]:hover:text-indigo-700`;

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
          {isApproved && (
            <div className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-50 border-emerald-200 text-emerald-700">
              ✓ Approved
            </div>
          )}
        </div>

        {docUrl && (
          <div className="mt-3">
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
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-12 text-center">
          <div className="text-3xl mb-3 text-slate-300">◆</div>
          <div className="font-medium text-slate-500 mb-1">Article is being written</div>
          <div className="text-sm text-slate-400">Check back in a few minutes — generation takes about 10 minutes.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SEO Metadata */}
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Article</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Article
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setIsEditing(false); setFeedback(null); }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg border border-indigo-700 transition-all disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className={`${proseClasses} outline-none min-h-[200px] ring-2 ring-inset ring-indigo-200 rounded-xl p-4 -mx-4`}
                />
              ) : (
                <div
                  className={proseClasses}
                  dangerouslySetInnerHTML={{ __html: articleHtml }}
                />
              )}
            </div>
          )}

          {/* Feedback toast */}
          {feedback && (
            <div className={`text-sm px-4 py-3 rounded-xl border ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {feedback.message}
            </div>
          )}

          {/* Approve */}
          {!isApproved && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <p className="text-sm text-slate-500 mb-4">
                Edit the article above if needed, then approve it when you&apos;re ready to publish.
              </p>
              <button
                onClick={() => void handleApprove()}
                disabled={approving || isEditing}
                className="px-6 py-3 rounded-xl text-sm font-semibold bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {approving ? "Saving…" : "Approve Article"}
              </button>
            </div>
          )}

          {/* Approved banner */}
          {isApproved && (
            <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-5">
              <p className="text-sm font-medium text-emerald-800">
                ✓ You approved this article. We&apos;ll publish it as a WordPress draft shortly.
              </p>
              <button
                onClick={() => setResult((r) => r ? { ...r, fields: { ...r.fields, portal_approval: null } } : r)}
                className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
              >
                Undo approval
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
