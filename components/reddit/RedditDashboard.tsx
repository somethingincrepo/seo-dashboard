"use client";

import { useState, useCallback } from "react";
import type { RedditOpportunity } from "@/lib/reddit";
import type { ThreadDetail, RedditComment } from "@/app/api/reddit/thread/route";

// ─── Time helper ─────────────────────────────────────────────────────────────

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

// ─── Relevance badge ──────────────────────────────────────────────────────────

function RelevanceBadge({ score }: { score: number }) {
  const color = score >= 80
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 50
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-slate-50 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-inset ${color}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-60" />
      Relevance: {score}/100
    </span>
  );
}

// ─── Comment tree ─────────────────────────────────────────────────────────────

function CommentNode({ comment, depth = 0 }: { comment: RedditComment; depth?: number }) {
  return (
    <div className={`${depth > 0 ? "ml-4 border-l border-slate-100 pl-3" : ""}`}>
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-slate-700">u/{comment.author}</span>
          <span className="text-[10px] text-slate-400">▲ {comment.score}</span>
          <span className="text-[10px] text-slate-400">{timeAgo(comment.created_utc)}</span>
        </div>
        <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-line">
          {comment.body.slice(0, 500)}{comment.body.length > 500 ? "…" : ""}
        </p>
      </div>
      {comment.replies.slice(0, 3).map(r => (
        <CommentNode key={r.id} comment={r} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Thread detail panel ──────────────────────────────────────────────────────

function ThreadDetail({
  opportunity,
  clientId,
  apiPath,
  onStatusChange,
}: {
  opportunity: RedditOpportunity;
  clientId: string;
  apiPath: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [status, setStatus] = useState(opportunity.status);
  const [pending, setPending] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    if (fetched || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reddit/thread?permalink=${encodeURIComponent(opportunity.permalink)}`);
      if (res.ok) setDetail(await res.json());
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [opportunity.permalink, fetched, loading]);

  // Auto-fetch on mount
  useState(() => { fetchThread(); });

  async function setOpStatus(next: "viewed" | "replied" | "dismissed") {
    if (pending) return;
    setPending(next);
    try {
      const body: Record<string, string> = { id: opportunity.id, status: next };
      if (!apiPath.includes("portal")) body.clientId = clientId;
      await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(next);
      onStatusChange(opportunity.id, next);
    } finally {
      setPending(null);
    }
  }

  const o = opportunity;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-orange-600">r/{o.subreddit}</span>
            <span className="text-[10px] text-slate-400">{timeAgo(o.created_utc)}</span>
            {o.opportunity_type === "mention" && (
              <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-violet-100">
                mention
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={o.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-orange-500 hover:text-orange-700 flex items-center gap-1 transition-colors"
            >
              View on Reddit
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>

        <h2 className="text-base font-semibold text-slate-900 leading-snug">
          {detail?.title ?? o.title}
        </h2>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {detail && <span>▲ {detail.score} · {Math.round(detail.upvote_ratio * 100)}% upvoted</span>}
          {detail && <span>💬 {detail.num_comments} comments</span>}
          {detail?.author && <span>by u/{detail.author}</span>}
        </div>

        <div className="flex items-center gap-2">
          <RelevanceBadge score={o.relevance_score} />
          {o.ranks_on_google && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg ring-1 ring-inset ring-emerald-200">
              ★ Ranks on Google
            </span>
          )}
        </div>

        {o.ai_explanation && (
          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            {o.ai_explanation}
          </p>
        )}

        {/* Status actions */}
        {status !== "dismissed" && (
          <div className="flex items-center gap-2 pt-1">
            {(["viewed", "replied", "dismissed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setOpStatus(s)}
                disabled={!!pending}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60 capitalize font-medium ${
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

      {/* Thread body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-8 text-center text-slate-400 text-sm">Loading thread…</div>
        )}

        {!loading && detail && (
          <div className="divide-y divide-slate-100">
            {/* OP post body */}
            {detail.selftext && (
              <div className="p-5">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Post</div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {detail.selftext.slice(0, 1000)}{detail.selftext.length > 1000 ? "…" : ""}
                </p>
              </div>
            )}

            {/* Comments */}
            {detail.comments.length > 0 && (
              <div className="p-5">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Top Comments ({detail.comments.length})
                </div>
                <div className="space-y-1 divide-y divide-slate-50">
                  {detail.comments.map(c => (
                    <CommentNode key={c.id} comment={c} />
                  ))}
                </div>
              </div>
            )}

            {detail.comments.length === 0 && !detail.selftext && (
              <div className="p-8 text-center text-slate-400 text-sm">No content available</div>
            )}
          </div>
        )}

        {!loading && fetched && !detail && (
          <div className="p-8 text-center space-y-2">
            <p className="text-slate-400 text-sm">Couldn&apos;t load thread content.</p>
            <a
              href={o.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-orange-500 hover:text-orange-700"
            >
              View on Reddit ↗
            </a>
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

      <div className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
        {o.title}
      </div>

      {o.ai_explanation && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
          {o.ai_explanation}
        </p>
      )}

      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span>▲ {o.upvotes}</span>
        {o.num_comments > 0 && <span>💬 {o.num_comments}</span>}
        {o.ranks_on_google && <span className="text-emerald-600 font-medium">★ Google</span>}
        {o.status !== "new" && (
          <span className="capitalize text-slate-300">{o.status}</span>
        )}
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
    setItems(prev => prev.map(o => o.id === id ? { ...o, status: status as RedditOpportunity["status"] } : o));
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
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Left: thread list */}
      <div className="w-[380px] shrink-0 overflow-y-auto space-y-2 pr-1">
        <div className="text-xs text-slate-400 mb-3">{total} posts found</div>
        {items.map(o => (
          <ThreadRow
            key={o.id}
            opportunity={o}
            isActive={selected?.id === o.id}
            onClick={() => setSelected(o)}
          />
        ))}
      </div>

      {/* Right: thread detail */}
      <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white">
        {selected ? (
          <ThreadDetail
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
  );
}
