"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RedditOpportunity } from "@/lib/reddit";

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
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
  const color = score >= 80
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 50
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-slate-50 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ring-1 ring-inset ${color}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-70" />
      Relevance: {score}/100
    </span>
  );
}

type Props = {
  opportunity: RedditOpportunity;
  clientId: string;
  apiPath: string;
  isActive?: boolean;
  onClick?: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  viewed: "Viewed",
  replied: "Replied",
  dismissed: "Dismissed",
};

export function ThreadCard({ opportunity: o, clientId, apiPath, isActive, onClick }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(o.status);
  const [pending, setPending] = useState<string | null>(null);

  async function setOpportunityStatus(next: "viewed" | "replied" | "dismissed") {
    if (next === status || pending) return;
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
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const hostname = (() => {
    try { return new URL(o.permalink).hostname; } catch { return "reddit.com"; }
  })();

  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-xl cursor-pointer transition-all space-y-3 ${
        isActive
          ? "border-orange-300 bg-orange-50/40 shadow-sm"
          : status === "dismissed"
          ? "border-slate-100 bg-slate-50/50 opacity-60"
          : "border-slate-200 bg-white hover:border-orange-200 hover:shadow-sm"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="10" r="10" />
              <path fill="white" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.07 2.13.45a1 1 0 1 0 1-.97 1 1 0 0 0-.96.68l-2.38-.5a.27.27 0 0 0-.32.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.8 2.8 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.8 2.8 0 0 0 0-.44 1.46 1.46 0 0 0 .68-1.62zm-9.4 1.1a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.63a3.57 3.57 0 0 1-2.85.79 3.57 3.57 0 0 1-2.85-.79.28.28 0 0 1 .4-.4 3 3 0 0 0 2.45.65 3 3 0 0 0 2.45-.65.28.28 0 0 1 .4.4zm-.17-1.63a1 1 0 1 1 1-1 1 1 0 0 1-1 1z" />
            </svg>
            r/{o.subreddit}
          </span>
          <span className="text-[10px] text-slate-400">{timeAgo(o.created_utc)}</span>
          {o.opportunity_type === "mention" && (
            <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-violet-100">
              mention
            </span>
          )}
          {status !== "new" && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>
        <a
          href={o.permalink}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-orange-500 hover:text-orange-700 flex items-center gap-0.5 shrink-0 transition-colors"
        >
          View on Reddit
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
        {o.title}
      </div>

      {/* URL */}
      <div className="text-[11px] text-slate-400 truncate">
        ↗ {hostname}{o.permalink.replace(/^https?:\/\/[^/]+/, "").slice(0, 60)}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          {o.upvotes}
        </span>
        {o.num_comments > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {o.num_comments} Comments
          </span>
        )}
      </div>

      {/* Relevance score + explanation */}
      <div className="space-y-1.5">
        <RelevanceBadge score={o.relevance_score} />
        {o.ai_explanation && (
          <p className="text-[11px] text-slate-500 leading-relaxed">{o.ai_explanation}</p>
        )}
      </div>

      {/* Status actions */}
      {status !== "dismissed" && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
          {(["viewed", "replied", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setOpportunityStatus(s)}
              disabled={!!pending}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all disabled:opacity-60 capitalize ${
                status === s
                  ? (s as string) === "replied" ? "bg-emerald-600 text-white border-emerald-600"
                  : (s as string) === "dismissed" ? "bg-red-100 text-red-600 border-red-200"
                  : "bg-slate-900 text-white border-slate-900"
                  : "text-slate-500 border-slate-200 hover:border-slate-400 bg-white cursor-pointer"
              }`}
            >
              {pending === s ? "…" : s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
