"use client";

import { useState, useCallback, useEffect } from "react";
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

// ─── Thread detail right panel ────────────────────────────────────────────────

type ThreadComment = { author: string; body: string; score: number };

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
  const [comments, setComments] = useState<ThreadComment[] | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // Auto-load when thread is selected
  useEffect(() => {
    void fetchThread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id]);

  async function fetchThread() {
    if (commentsLoading) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/reddit/thread?permalink=${encodeURIComponent(o.permalink)}`);
      const data = await res.json() as { selftext?: string; comments?: ThreadComment[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setComments(data.comments ?? []);
      if (data.selftext && data.selftext.trim()) setFullText(data.selftext);
    } catch (e) {
      setCommentsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setCommentsLoading(false);
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

  // Strip trailing truncation markers that DataForSEO appends
  const snippet = o.snippet
    ?.replace(/\.?\s*Read more\s*$/i, "")
    .replace(/\.{2,}$/, "")
    .replace(/…$/, "")
    .trim();

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
        <a
          href={o.permalink}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-orange-500 hover:text-orange-700 flex items-center gap-1 transition-colors font-medium"
        >
          View on Reddit
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Title */}
        <h2 className="text-[15px] font-semibold text-slate-900 leading-snug">{o.title}</h2>

        {/* Scores row */}
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

        {/* Thread body */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            {fullText ? "Thread Content" : "Thread Preview"}
          </div>
          {commentsLoading && !fullText && (
            <div className="flex items-center gap-2 text-[12px] text-slate-400">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Loading thread…
            </div>
          )}
          {!commentsLoading && (fullText || snippet) && (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {fullText ?? snippet}
            </p>
          )}
        </div>

        {/* Keyword */}
        <div className="text-[11px] text-slate-400">
          Surfaced by keyword: <span className="text-slate-600 font-medium">{o.keyword}</span>
        </div>

        {/* Engage + Fetch Comments row */}
        <div className="border-t border-slate-100 pt-4 flex items-center gap-3 flex-wrap">
          <a
            href={o.permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="10" r="10" />
              <path fill="white" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.07 2.13.45a1 1 0 1 0 1-.97 1 1 0 0 0-.96.68l-2.38-.5a.27.27 0 0 0-.32.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.8 2.8 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.8 2.8 0 0 0 0-.44 1.46 1.46 0 0 0 .68-1.62zm-9.4 1.1a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.63a3.57 3.57 0 0 1-2.85.79 3.57 3.57 0 0 1-2.85-.79.28.28 0 0 1 .4-.4 3 3 0 0 0 2.45.65 3 3 0 0 0 2.45-.65.28.28 0 0 1 .4.4zm-.17-1.63a1 1 0 1 1 1-1 1 1 0 0 1-1 1z" />
            </svg>
            Open Thread &amp; Reply on Reddit
          </a>

          <button
            onClick={fetchThread}
            disabled={commentsLoading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-800 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-all"
          >
            {commentsLoading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Fetching…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Fetch Comments
              </>
            )}
          </button>
        </div>

        {/* Error state */}
        {commentsError && (
          <div className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {commentsError}
          </div>
        )}

        {/* Comments */}
        {comments !== null && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Top Comments {comments.length > 0 ? `(${comments.length})` : ""}
            </div>
            {comments.length === 0 ? (
              <p className="text-[11px] text-slate-400">No comments on this thread yet.</p>
            ) : (
              comments.map((c, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">u/{c.author}</span>
                    <span className="text-[10px] text-slate-400">▲ {c.score}</span>
                  </div>
                  <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">{c.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Status actions pinned to bottom */}
      {status !== "dismissed" && (
        <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 bg-white shrink-0">
          <span className="text-xs text-slate-400 mr-1">Mark as:</span>
          {(["viewed", "replied", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setOpStatus(s)}
              disabled={!!pending}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60 font-medium capitalize ${
                status === s
                  ? (s as string) === "replied" ? "bg-emerald-600 text-white border-emerald-600"
                  : (s as string) === "dismissed" ? "bg-red-100 text-red-600 border-red-200"
                  : "bg-slate-900 text-white border-slate-900"
                  : "text-slate-600 border-slate-200 hover:border-slate-400 bg-white cursor-pointer"
              }`}
            >
              {pending === s ? "…" : s === "viewed" ? "Mark Viewed" : s === "replied" ? "Replied" : "Dismiss"}
            </button>
          ))}
        </div>
      )}
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

      <div className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
        {o.title}
      </div>

      {o.ai_explanation && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
          {o.ai_explanation}
        </p>
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
  const [selected, setSelected] = useState<RedditOpportunity | null>(
    initialItems[0] ?? null
  );

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
        {/* Left: thread list */}
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

        {/* Right: thread detail — full height */}
        <div className="flex-1 min-w-0 overflow-hidden">
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
