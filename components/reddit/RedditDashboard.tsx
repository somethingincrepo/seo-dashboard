"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { RedditOpportunity } from "@/lib/reddit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(input: string | number): string {
  try {
    const ts = typeof input === "number" ? input * 1000 : new Date(input).getTime();
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch { return ""; }
}

function RelevanceBadge({ score }: { score: number }) {
  const color = score >= 70
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 45
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-slate-50 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-inset ${color}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-60" />
      Relevance: {score}/100
    </span>
  );
}

// ─── Comment composer ─────────────────────────────────────────────────────────

type StoredComment = { author: string; body: string; score: number };

const TONES = ["Helpful", "Professional", "Casual", "Friendly", "Expert"] as const;
const LENGTHS = ["Short", "Medium", "Long"] as const;
type Tone = (typeof TONES)[number];
type Length = (typeof LENGTHS)[number];

function ToolbarBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors text-[11px] font-bold"
    >
      {children}
    </button>
  );
}

function CommentComposer({
  opportunity: o,
  selftext,
  comments,
  onClose,
}: {
  opportunity: RedditOpportunity;
  selftext: string | null;
  comments: StoredComment[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState<Tone>("Helpful");
  const [length, setLength] = useState<Length>("Medium");
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after = before) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = draft.slice(start, end);
    const next = draft.slice(0, start) + before + selected + after + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  }

  async function callGenerate(refineMode = false) {
    if (refineMode) setRefining(true);
    else setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/reddit/generate-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: o.title,
          selftext,
          comments: comments.slice(0, 5),
          keyword: o.keyword,
          subreddit: o.subreddit,
          permalink: o.permalink,
          tone,
          length,
          existingDraft: refineMode ? draft : undefined,
        }),
      });
      const data = await res.json() as { comment?: string; error?: string };
      if (!res.ok || !data.comment) throw new Error(data.error ?? "Generation failed");
      setDraft(data.comment);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
      setRefining(false);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const busy = generating || refining;

  return (
    <div className="border-t-2 border-slate-200 bg-white shrink-0 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-700">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <span className="text-[13px] font-semibold text-white">Add Comment</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Account row */}
      <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 border-b border-slate-200">
        {/* Reddit alien avatar */}
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="white">
            <circle cx="10" cy="10" r="10" fill="#FF4500"/>
            <path fill="white" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.07 2.13.45a1 1 0 1 0 1-.97 1 1 0 0 0-.96.68l-2.38-.5a.27.27 0 0 0-.32.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.8 2.8 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.8 2.8 0 0 0 0-.44 1.46 1.46 0 0 0 .68-1.62zm-9.4 1.1a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.63a3.57 3.57 0 0 1-2.85.79 3.57 3.57 0 0 1-2.85-.79.28.28 0 0 1 .4-.4 3 3 0 0 0 2.45.65 3 3 0 0 0 2.45-.65.28.28 0 0 1 .4.4zm-.17-1.63a1 1 0 1 1 1-1 1 1 0 0 1-1 1z"/>
          </svg>
        </div>
        <span className="text-[12px] font-medium text-slate-700">Your Reddit Account</span>
        <svg className="w-3.5 h-3.5 text-slate-400 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </div>

      {/* Editor */}
      <div className="border border-slate-200 mx-4 mt-3 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
          <ToolbarBtn title="Bold" onClick={() => wrapSelection("**")}><span className="font-black">B</span></ToolbarBtn>
          <ToolbarBtn title="Italic" onClick={() => wrapSelection("*")}><span className="italic">I</span></ToolbarBtn>
          <ToolbarBtn title="Strikethrough" onClick={() => wrapSelection("~~")}><span className="line-through">S</span></ToolbarBtn>
          <ToolbarBtn title="Superscript" onClick={() => wrapSelection("^")}><span>X<sup>2</sup></span></ToolbarBtn>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ToolbarBtn title="Link" onClick={() => wrapSelection("[", "](url)")}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Bullet list" onClick={() => setDraft((d) => d + "\n- ")}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Numbered list" onClick={() => setDraft((d) => d + "\n1. ")}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor"/><path d="M4 10h2" stroke="currentColor"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor"/></svg>
          </ToolbarBtn>
          <ToolbarBtn title="Inline code" onClick={() => wrapSelection("`")}><span className="font-mono text-[10px]">&lt;&gt;</span></ToolbarBtn>
          <ToolbarBtn title="Code block" onClick={() => wrapSelection("```\n", "\n```")}><span className="font-mono text-[10px]">{"{}"}</span></ToolbarBtn>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply..."
          rows={4}
          className="w-full text-[13px] text-slate-800 bg-white px-3 py-2.5 resize-none focus:outline-none leading-relaxed placeholder:text-slate-400"
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-slate-200">
          <div className="flex items-center gap-2">
            {/* Generate button */}
            <button
              onClick={() => callGenerate(false)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
            >
              {generating ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              )}
              {generating ? "Writing…" : "Generate Comment"}
            </button>

            {/* Tone selector */}
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-300 cursor-pointer"
            >
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>

            {/* Length selector */}
            <select
              value={length}
              onChange={(e) => setLength(e.target.value as Length)}
              className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-300 cursor-pointer"
            >
              {LENGTHS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* Copy */}
            <button
              onClick={copyDraft}
              disabled={!draft}
              title="Copy to clipboard"
              className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
            </button>

            {/* Refine with AI */}
            <button
              onClick={() => callGenerate(true)}
              disabled={!draft || busy}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-700 disabled:opacity-30 transition-colors"
            >
              {refining ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              )}
              {refining ? "Refining…" : "Refine with AI"}
            </button>
          </div>
        </div>
      </div>

      {genError && (
        <p className="text-[11px] text-red-500 bg-red-50 mx-4 mt-2 rounded-lg px-3 py-2">{genError}</p>
      )}

      {/* How to post — shown once draft exists */}
      {draft && (
        <div className="mx-4 mt-2 mb-3 border border-dashed border-orange-200 rounded-lg px-3.5 py-3 bg-orange-50/40">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">How to post this</p>
          <div className="space-y-1">
            {["Copy the comment (icon above)", "Open the Reddit thread →", "Click "Add a Comment" and paste", "Review and hit Reply"].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-orange-400 text-white text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-[11px] text-slate-600 leading-relaxed">{step}</span>
                {i === 1 && (
                  <a href={o.permalink} target="_blank" rel="noreferrer" className="text-[11px] text-orange-500 hover:text-orange-700 font-medium ml-1">here</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Thread detail right panel ────────────────────────────────────────────────

function ThreadDetailPanel({
  opportunity: o,
  clientId,
  apiPath,
  onStatusChange,
}: {
  opportunity: RedditOpportunity;
  clientId: string;
  apiPath: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [status, setStatus] = useState(o.status);
  const [pending, setPending] = useState<string | null>(null);

  // Thread content — auto-loaded on select
  const [loadingThread, setLoadingThread] = useState(true);
  const [liveSelftext, setLiveSelftext] = useState<string | null>(null);

  // Comments — only loaded when user explicitly asks
  const [liveComments, setLiveComments] = useState<StoredComment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const cachedComments = useRef<StoredComment[] | null>(null);

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);

  // Auto-load selftext when thread is selected; cache comments in ref (don't display yet)
  useEffect(() => {
    setLiveSelftext(null);
    setLiveComments(null);
    setLoadingThread(true);
    setComposerOpen(false);
    cachedComments.current = null;

    fetch(`/api/reddit/thread?permalink=${encodeURIComponent(o.permalink)}`)
      .then((r) => r.json())
      .then((data: { selftext?: string | null; comments?: StoredComment[] }) => {
        setLiveSelftext(data.selftext ?? null);
        cachedComments.current = data.comments ?? [];
      })
      .catch(() => { /* silently fail — snippet still shows */ })
      .finally(() => setLoadingThread(false));
  }, [o.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoadComments() {
    if (cachedComments.current !== null) {
      setLiveComments(cachedComments.current);
    } else {
      setLoadingComments(true);
      fetch(`/api/reddit/thread?permalink=${encodeURIComponent(o.permalink)}`)
        .then((r) => r.json())
        .then((data: { selftext?: string | null; comments?: StoredComment[] }) => {
          setLiveComments(data.comments ?? []);
          if (data.selftext) setLiveSelftext(data.selftext);
        })
        .catch(() => setLiveComments([]))
        .finally(() => setLoadingComments(false));
    }
  }

  async function setOpStatus(next: "viewed" | "replied" | "dismissed") {
    if (pending) return;
    setPending(next);
    try {
      const body: Record<string, string> = { id: o.id, status: next };
      if (!apiPath.includes("portal")) body.clientId = clientId;
      await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(next);
      onStatusChange(o.id, next);
    } finally {
      setPending(null);
    }
  }

  const snippet = o.snippet
    ?.replace(/\.?\s*Read more\s*$/i, "")
    .replace(/\.{2,}$/, "")
    .replace(/…$/, "")
    .trim();

  const storedComments = o.top_comments as StoredComment[] | null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="10" r="10" />
              <path fill="white" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.07 2.13.45a1 1 0 1 0 1-.97 1 1 0 0 0-.96.68l-2.38-.5a.27.27 0 0 0-.32.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.8 2.8 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.8 2.8 0 0 0 0-.44 1.46 1.46 0 0 0 .68-1.62zm-9.4 1.1a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.63a3.57 3.57 0 0 1-2.85.79 3.57 3.57 0 0 1-2.85-.79.28.28 0 0 1 .4-.4 3 3 0 0 0 2.45.65 3 3 0 0 0 2.45-.65.28.28 0 0 1 .4.4zm-.17-1.63a1 1 0 1 1 1-1 1 1 0 0 1-1 1z" />
            </svg>
            r/{o.subreddit}
          </span>
          <span className="text-[10px] text-slate-400">{timeAgo(o.created_utc)}</span>
          {o.opportunity_type === "mention" && (
            <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-violet-100">mention</span>
          )}
        </div>
        <a href={o.permalink} target="_blank" rel="noreferrer"
          className="text-[11px] text-orange-500 hover:text-orange-700 flex items-center gap-1 transition-colors font-medium">
          View on Reddit
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto bg-white p-5 space-y-5">
        {/* Title */}
        <h2 className="text-[15px] font-semibold text-slate-900 leading-snug">{o.title}</h2>

        {/* Scores */}
        <div className="flex items-center gap-2 flex-wrap">
          <RelevanceBadge score={o.relevance_score} />
          {o.ranks_on_google && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg ring-1 ring-inset ring-emerald-200">
              ★ Ranks on Google
            </span>
          )}
        </div>

        {/* AI Explanation */}
        {o.ai_explanation && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Why this matters</div>
            <p className="text-sm text-slate-600 leading-relaxed">{o.ai_explanation}</p>
          </div>
        )}

        {/* Thread content — auto-loaded */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            {liveSelftext ? "Thread Content" : "Thread Preview"}
            {loadingThread && <span className="text-[9px] font-normal normal-case animate-pulse">Loading…</span>}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {liveSelftext
              ? liveSelftext
              : !loadingThread
              ? (snippet || "This is a link post — no text body. See comments below.")
              : (snippet || "")}
          </p>
        </div>

        {/* Comments — only shown after user clicks Load */}
        {liveComments !== null && (
          <div className="border-t border-slate-100 pt-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Top Comments {liveComments.length > 0 ? `(${liveComments.length})` : ""}
            </div>
            {liveComments.length > 0 ? (
              <div className="space-y-3">
                {liveComments.map((c, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">u/{c.author}</span>
                      {c.score > 0 && <span className="text-[10px] text-slate-400">▲ {c.score}</span>}
                    </div>
                    <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">{c.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No comments found for this thread.</p>
            )}
          </div>
        )}

        {/* Stored fallback comments shown when live not loaded */}
        {liveComments === null && storedComments && storedComments.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Cached Comments ({storedComments.length})
            </div>
            <div className="space-y-3">
              {storedComments.map((c, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">u/{c.author}</span>
                    {c.score > 0 && <span className="text-[10px] text-slate-400">▲ {c.score}</span>}
                  </div>
                  <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyword */}
        <div className="text-[11px] text-slate-400">
          Surfaced by keyword: <span className="text-slate-600 font-medium">{o.keyword}</span>
        </div>

        {/* Action row */}
        <div className="border-t border-slate-100 pt-4 flex items-center gap-3 flex-wrap">
          <a href={o.permalink} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 px-4 py-2.5 rounded-xl transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="10" r="10" />
              <path fill="white" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.07 2.13.45a1 1 0 1 0 1-.97 1 1 0 0 0-.96.68l-2.38-.5a.27.27 0 0 0-.32.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.8 2.8 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.8 2.8 0 0 0 0-.44 1.46 1.46 0 0 0 .68-1.62zm-9.4 1.1a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.63a3.57 3.57 0 0 1-2.85.79 3.57 3.57 0 0 1-2.85-.79.28.28 0 0 1 .4-.4 3 3 0 0 0 2.45.65 3 3 0 0 0 2.45-.65.28.28 0 0 1 .4.4zm-.17-1.63a1 1 0 1 1 1-1 1 1 0 0 1-1 1z" />
            </svg>
            Open on Reddit
          </a>

          <button
            onClick={handleLoadComments}
            disabled={loadingComments || loadingThread}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-800 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-all"
          >
            {loadingComments ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Loading…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {liveComments !== null ? "Refresh Comments" : "Load Comments"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI comment composer — expands above bottom bar */}
      {composerOpen && (
        <CommentComposer
          opportunity={o}
          selftext={liveSelftext}
          comments={liveComments ?? storedComments ?? []}
          onClose={() => setComposerOpen(false)}
        />
      )}

      {/* Bottom bar — Write a Reply + status buttons */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 bg-white shrink-0">
        <button
          onClick={() => setComposerOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
            composerOpen
              ? "bg-violet-600 text-white"
              : "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {composerOpen ? "Close Composer" : "Write a Reply"}
        </button>

        {status !== "dismissed" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Mark as:</span>
            {(["viewed", "replied", "dismissed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setOpStatus(s)}
                disabled={!!pending}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60 font-medium capitalize ${
                  (status as string) !== s
                    ? "text-slate-600 border-slate-200 hover:border-slate-400 bg-white cursor-pointer"
                    : s === "replied" ? "bg-emerald-600 text-white border-emerald-600"
                    : s === "dismissed" ? "bg-red-100 text-red-600 border-red-200"
                    : "bg-slate-900 text-white border-slate-900"
                }`}
              >
                {pending === s ? "…" : s === "viewed" ? "Mark Viewed" : s === "replied" ? "Replied" : "Dismiss"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Left panel thread row ────────────────────────────────────────────────────

function ThreadRow({
  opportunity: o,
  isActive,
  onClick,
}: {
  opportunity: RedditOpportunity;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-xl cursor-pointer transition-all space-y-2 ${
        isActive
          ? "border-orange-300 bg-orange-50/50 shadow-sm"
          : o.status === "dismissed"
          ? "border-slate-100 bg-slate-50 opacity-50"
          : "border-slate-200 bg-white hover:border-orange-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-orange-600">r/{o.subreddit}</span>
          <span className="text-[10px] text-slate-400">{timeAgo(o.created_utc)}</span>
          {o.opportunity_type === "mention" && (
            <span className="text-[10px] text-violet-600 bg-violet-50 px-1 py-0.5 rounded">mention</span>
          )}
        </div>
        <RelevanceBadge score={o.relevance_score} />
      </div>
      <div className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{o.title}</div>
      {o.ai_explanation && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{o.ai_explanation}</p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        {o.ranks_on_google && <span className="text-emerald-600 font-medium">★ Google</span>}
        {o.status !== "new" && <span className="capitalize text-slate-300">{o.status}</span>}
        <span className="text-slate-300">{o.keyword}</span>
      </div>
    </div>
  );
}

// ─── Main two-panel dashboard ─────────────────────────────────────────────────

export function RedditDashboard({
  initialItems,
  total,
  clientId,
  apiPath,
  emptyMessage,
}: {
  initialItems: RedditOpportunity[];
  total: number;
  clientId: string;
  apiPath: string;
  emptyMessage?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<RedditOpportunity | null>(initialItems[0] ?? null);

  const handleStatusChange = useCallback((id: string, status: string) => {
    setItems(prev => prev.map(o =>
      o.id === id ? { ...o, status: status as RedditOpportunity["status"] } : o
    ));
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, status: status as RedditOpportunity["status"] } : null);
    }
  }, [selected]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        {emptyMessage ?? "No threads found. The daily scan runs at 6am UTC."}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-1 min-h-0 border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="w-[360px] shrink-0 border-r border-slate-100 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <span className="text-xs text-slate-400">{total} posts found</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.map(o => (
              <ThreadRow
                key={o.id}
                opportunity={o}
                isActive={selected?.id === o.id}
                onClick={() => setSelected(o)}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden bg-white">
          {selected ? (
            <ThreadDetailPanel
              key={selected.id}
              opportunity={selected}
              clientId={clientId}
              apiPath={apiPath}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Select a thread to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
