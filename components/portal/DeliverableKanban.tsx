"use client";

import Link from "next/link";
import type { ContentJob, ContentResult } from "@/lib/content";
import type { ContentRefresh, PageCreationSuggestion } from "@/lib/supabase";
import type { RedditOpportunity } from "@/lib/reddit";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliverableType = "content" | "refresh" | "page-creation" | "internal-link" | "reddit";

type KanbanCard = {
  id: string;
  type: DeliverableType;
  title: string;
  keyword?: string;
  date: string;
  href: string;           // destination page when clicked
  subLabel?: string;      // e.g. page type, subreddit
};

type Column = {
  key: string;
  label: string;
  accent: string;         // border-top color class
  badgeClass: string;     // badge bg/text
  cards: KanbanCard[];
};

// ── Type configs ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<DeliverableType, { label: string; pill: string }> = {
  "content":       { label: "Content",        pill: "bg-blue-50 text-blue-700" },
  "refresh":       { label: "Refresh",         pill: "bg-violet-50 text-violet-700" },
  "page-creation": { label: "Page Creation",   pill: "bg-emerald-50 text-emerald-700" },
  "internal-link": { label: "Internal Link",   pill: "bg-amber-50 text-amber-700" },
  "reddit":        { label: "Reddit",          pill: "bg-orange-50 text-orange-700" },
};

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

// ── Build cards from data ─────────────────────────────────────────────────────

function buildColumns(
  contentJobs: ContentJob[],
  contentResults: ContentResult[],
  contentRefreshes: ContentRefresh[],
  pageCreations: PageCreationSuggestion[],
  internalLinkChanges: InternalLinkChange[],
  redditOpportunities: RedditOpportunity[],
  token: string,
): Column[] {
  const base = `/portal/${token}`;

  const needsReview: KanbanCard[] = [];
  const inProgress: KanbanCard[] = [];
  const approved: KanbanCard[] = [];
  const live: KanbanCard[] = [];

  // ── Content ──────────────────────────────────────────────────────────────

  // Result in the job record to see which jobs have results
  const resultsByJobId = new Map<string, ContentResult>();
  for (const r of contentResults) {
    const jobId = r.fields["Job ID"]?.[0];
    if (jobId) resultsByJobId.set(jobId, r);
  }

  for (const job of contentJobs) {
    const ts = job.fields.title_status;
    const title = job.fields["Blog Title"] || "Untitled";
    const keyword = job.fields.target_keyword ?? undefined;
    const result = resultsByJobId.get(job.id);
    const href = `${base}/content`;

    if (ts === "published") {
      live.push({ id: job.id, type: "content", title, keyword, date: fmt(job.fields.approved_at), href, subLabel: job.fields.page_type ?? undefined });
    } else if (result && result.fields.portal_approval === "approved") {
      approved.push({ id: job.id, type: "content", title, keyword, date: fmt(result.fields.portal_approved_at), href, subLabel: job.fields.page_type ?? undefined });
    } else if (result && !result.fields.portal_approval) {
      needsReview.push({ id: result.id, type: "content", title: result.fields["Article title"] || title, keyword, date: fmt(result.createdTime), href: `${base}/content/${job.id}`, subLabel: "Review article" });
    } else if (ts === "titled") {
      needsReview.push({ id: job.id, type: "content", title, keyword, date: fmt(job.fields.proposed_at), href: `${base}/content/titles`, subLabel: "Approve title" });
    } else if (ts === "approved" || ts === "generating") {
      inProgress.push({ id: job.id, type: "content", title, keyword, date: fmt(job.fields.approved_at), href, subLabel: ts === "generating" ? "Writing…" : "Queued" });
    }
  }

  // ── Content Refreshes ─────────────────────────────────────────────────────

  for (const r of contentRefreshes) {
    const title = r.display_title || r.refresh_url;
    const keyword = r.target_keyword;
    const href = `${base}/content-optimization?id=${r.id}`;

    if (r.status === "published") {
      live.push({ id: r.id, type: "refresh", title, keyword, date: fmt(r.published_at), href, subLabel: r.page_type });
    } else if (r.status === "approved_for_publish") {
      approved.push({ id: r.id, type: "refresh", title, keyword, date: fmt(r.portal_approved_at), href, subLabel: r.page_type });
    } else if (r.status === "completed" && !r.portal_approval) {
      needsReview.push({ id: r.id, type: "refresh", title, keyword, date: fmt(r.generated_at ?? r.proposed_at), href, subLabel: "Review edits" });
    } else if (r.status === "in_progress" || r.status === "approved") {
      inProgress.push({ id: r.id, type: "refresh", title, keyword, date: fmt(r.proposed_at), href, subLabel: "Updating page…" });
    }
  }

  // ── Page Creation ─────────────────────────────────────────────────────────

  for (const s of pageCreations) {
    if (s.status === "skipped" || s.portal_approval === "skipped") continue;
    const title = s.page_title;
    const keyword = s.target_keyword;
    const href = `${base}/page-creation?id=${s.id}`;

    if (s.status === "published") {
      live.push({ id: s.id, type: "page-creation", title, keyword, date: fmt(s.published_at), href, subLabel: s.page_type });
    } else if (s.status === "approved_for_publish") {
      approved.push({ id: s.id, type: "page-creation", title, keyword, date: fmt(s.content_portal_approved_at), href, subLabel: s.page_type });
    } else if (s.status === "content_ready") {
      needsReview.push({ id: s.id, type: "page-creation", title, keyword, date: fmt(s.generated_at), href, subLabel: "Review generated page" });
    } else if (s.status === "generating") {
      inProgress.push({ id: s.id, type: "page-creation", title, keyword, date: fmt(s.proposed_at), href, subLabel: "Generating content…" });
    } else if (s.status === "suggested") {
      needsReview.push({ id: s.id, type: "page-creation", title, keyword, date: fmt(s.proposed_at), href, subLabel: s.page_type });
    }
  }

  // ── Internal Links ────────────────────────────────────────────────────────

  for (const c of internalLinkChanges) {
    const title = c.change_title || "Internal link update";
    const href = `${base}/internal-links?id=${c.id}`;
    const date = fmt(c.approved_at ?? c.identified_at);

    if (c.execution_status === "complete") {
      live.push({ id: c.id, type: "internal-link", title, date, href, subLabel: c.page_url ?? undefined });
    } else if (c.approval === "approved" && c.execution_status !== "complete") {
      inProgress.push({ id: c.id, type: "internal-link", title, date, href, subLabel: "Implementing…" });
    } else if (c.approval === "pending") {
      needsReview.push({ id: c.id, type: "internal-link", title, date: fmt(c.identified_at), href, subLabel: c.page_url ?? undefined });
    }
  }

  // ── Reddit ────────────────────────────────────────────────────────────────

  for (const opp of redditOpportunities) {
    if (opp.status === "dismissed") continue;
    const href = `${base}/reddit`;
    if (opp.status === "replied") {
      live.push({ id: opp.id, type: "reddit", title: opp.title, date: fmt(opp.created_at), href, subLabel: `r/${opp.subreddit}` });
    } else if (opp.status === "new" || opp.status === "viewed") {
      needsReview.push({ id: opp.id, type: "reddit", title: opp.title, keyword: opp.keyword, date: fmt(opp.created_at), href, subLabel: `r/${opp.subreddit}` });
    }
  }

  return [
    {
      key: "needs-review",
      label: "Needs Review",
      accent: "border-amber-400",
      badgeClass: "bg-amber-50 text-amber-700 ring-amber-200/60",
      cards: needsReview,
    },
    {
      key: "in-progress",
      label: "In Progress",
      accent: "border-blue-400",
      badgeClass: "bg-blue-50 text-blue-700 ring-blue-200/60",
      cards: inProgress,
    },
    {
      key: "approved",
      label: "Approved / Queued",
      accent: "border-violet-400",
      badgeClass: "bg-violet-50 text-violet-700 ring-violet-200/60",
      cards: approved,
    },
    {
      key: "live",
      label: "Live",
      accent: "border-emerald-400",
      badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
      cards: live,
    },
  ];
}

// ── Shared type for internal link changes ─────────────────────────────────────

export type InternalLinkChange = {
  id: string;
  change_title: string | null;
  page_url: string | null;
  approval: string | null;
  execution_status: string | null;
  identified_at: string | null;
  approved_at: string | null;
};

// ── Card component ────────────────────────────────────────────────────────────

function KanbanCard({ card }: { card: KanbanCard }) {
  const { label, pill } = TYPE_CONFIG[card.type];
  return (
    <Link href={card.href}>
      <div className="group bg-white border border-slate-200 rounded-lg px-3.5 py-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pill}`}>{label}</span>
          {card.subLabel && (
            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{card.subLabel}</span>
          )}
        </div>
        <p className="text-[13px] font-medium text-slate-800 leading-snug line-clamp-2 group-hover:text-slate-900">
          {card.title}
        </p>
        {card.keyword && (
          <p className="text-[11px] text-slate-400 mt-1 truncate">{card.keyword}</p>
        )}
        {card.date && (
          <p className="text-[11px] text-slate-400 mt-1.5">{card.date}</p>
        )}
      </div>
    </Link>
  );
}

// ── Column component ──────────────────────────────────────────────────────────

function KanbanColumn({ col }: { col: Column }) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={`flex items-center justify-between px-0 pb-3 border-b-2 ${col.accent} mb-3`}>
        <span className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider">{col.label}</span>
        {col.cards.length > 0 && (
          <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ring-1 ring-inset ${col.badgeClass}`}>
            {col.cards.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2.5 flex-1 overflow-y-auto">
        {col.cards.length === 0 ? (
          <div className="text-[12px] text-slate-300 py-6 text-center">None</div>
        ) : (
          col.cards.map((card) => <KanbanCard key={card.id} card={card} />)
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DeliverableKanban({
  contentJobs,
  contentResults,
  contentRefreshes,
  pageCreations,
  internalLinkChanges,
  redditOpportunities,
  token,
}: {
  contentJobs: ContentJob[];
  contentResults: ContentResult[];
  contentRefreshes: ContentRefresh[];
  pageCreations: PageCreationSuggestion[];
  internalLinkChanges: InternalLinkChange[];
  redditOpportunities: RedditOpportunity[];
  token: string;
}) {
  const columns = buildColumns(
    contentJobs,
    contentResults,
    contentRefreshes,
    pageCreations,
    internalLinkChanges,
    redditOpportunities,
    token
  );

  const totalActive = columns.slice(0, 3).reduce((n, c) => n + c.cards.length, 0);

  return (
    <div>
      {totalActive === 0 && columns[3].cards.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[15px] font-semibold text-slate-700 mb-1">All caught up</p>
          <p className="text-[13px] text-slate-400">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {columns.map((col) => <KanbanColumn key={col.key} col={col} />)}
        </div>
      )}
    </div>
  );
}
