"use client";

import { useState, useEffect, useCallback } from "react";
import { bracketToHtml } from "@/lib/bracketToHtml";
import type { ContentJob, ContentResult } from "@/lib/content";

// ── Types ─────────────────────────────────────────────────────────────────────

type RefreshItem = {
  job: ContentJob;
  result: ContentResult | null;
};

type ExtractedPage = {
  h1: string;
  metaDescription: string;
  sections: { level: 2 | 3; heading: string; paragraphs: string[] }[];
  wordCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getItemStatus(item: RefreshItem): "review" | "running" | "approved" | "proposed" {
  const ts = item.job.fields.title_status;
  const approval = item.result?.fields.portal_approval;
  if (ts === "completed" && !approval) return "review";
  if (ts === "approved" && !item.result) return "running";
  if (ts === "completed" && approval === "approved") return "approved";
  return "proposed";
}

const STATUS_CONFIG = {
  review:   { label: "Ready for Review", dot: "bg-indigo-400", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200/60" },
  running:  { label: "Refresh Running",  dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 ring-amber-200/60" },
  approved: { label: "Approved",         dot: "bg-emerald-400",badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
  proposed: { label: "Proposed",         dot: "bg-slate-300",  badge: "bg-slate-100 text-slate-500 ring-slate-200/60" },
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  "Blog Post":    "bg-blue-50 text-blue-700",
  "Service Page": "bg-violet-50 text-violet-700",
  "Landing Page": "bg-emerald-50 text-emerald-700",
  "Other":        "bg-slate-100 text-slate-600",
};

// ── SOP Pipeline strip ────────────────────────────────────────────────────────

function SopPipeline({ status }: { status: ReturnType<typeof getItemStatus> }) {
  const steps = [
    {
      sop: "audit_content",
      label: "Opportunity found",
      desc: "audit_content SOP scanned this page during the site audit and flagged it for improvement",
      done: true,
    },
    {
      sop: "content_refresh",
      label: "Page refreshed",
      desc: "content_refresh SOP fetched the live URL, rewrote headers and body, added missing sections",
      done: status === "review" || status === "approved",
    },
    {
      sop: "publish_article_wordpress",
      label: "Published to site",
      desc: "publish_article_wordpress SOP pushes the approved refresh to WordPress as a page update",
      done: status === "approved",
    },
  ];

  return (
    <div className="border border-slate-200 rounded-xl px-5 py-4 mb-5">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
        How this works — automated SOP pipeline
      </div>
      <div className="flex gap-0">
        {steps.map((step, i) => (
          <div key={step.sop} className="flex items-start gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                  step.done
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-300 text-slate-400"
                }`}
              >
                {step.done ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-px flex-1 mt-1 mb-1 min-h-[16px] ${step.done ? "bg-slate-700" : "bg-slate-200"}`} />
              )}
            </div>
            <div className="ml-3 pb-4 min-w-0 flex-1 pr-4">
              <div className="text-[12px] font-semibold text-slate-800 leading-tight">{step.label}</div>
              <code className="text-[10px] text-slate-400 font-mono">{step.sop}</code>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Original page panel ───────────────────────────────────────────────────────

function OriginalPanel({ url, token }: { url: string; token: string }) {
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(null);

    fetch(`/api/portal/content-optimization/proxy?token=${token}&url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Fetch failed");
        setPage(data as ExtractedPage);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [url, token]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Fetching live page…
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-2xl text-slate-300 mb-2">⚠</div>
          <div className="text-[13px] text-slate-500">{error ?? "Could not load page"}</div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-indigo-600 hover:underline mt-2 inline-block"
          >
            Open original page →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 prose-sm max-w-none">
      {/* Word count */}
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-4">
        ~{page.wordCount.toLocaleString()} words on live page
      </div>

      {/* H1 */}
      {page.h1 && (
        <h1 className="text-[18px] font-bold text-slate-900 leading-snug mb-4 pb-3 border-b border-slate-200">
          {page.h1}
        </h1>
      )}

      {/* Meta description */}
      {page.metaDescription && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Meta description</div>
          <p className="text-[12px] text-slate-600 italic">{page.metaDescription}</p>
        </div>
      )}

      {/* Sections */}
      {page.sections.length === 0 && (
        <p className="text-[13px] text-slate-400 italic">
          No structured sections detected — the page may use custom markup.
        </p>
      )}

      {page.sections.map((section, i) => (
        <div key={i} className="mb-5">
          {section.level === 2 ? (
            <h2 className="text-[15px] font-semibold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">
              {section.heading}
            </h2>
          ) : (
            <h3 className="text-[13px] font-semibold text-slate-700 mb-1.5 ml-3">
              {section.heading}
            </h3>
          )}
          {section.paragraphs.map((para, j) => (
            <p key={j} className="text-[13px] text-slate-600 leading-relaxed mb-2">
              {para}
            </p>
          ))}
          {section.paragraphs.length === 0 && (
            <p className="text-[12px] text-slate-400 italic ml-3">Section present but content not extracted</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Refreshed content panel ───────────────────────────────────────────────────

function RefreshedPanel({ result }: { result: ContentResult }) {
  const body = result.fields["Article body"] ?? "";
  const html = bracketToHtml(body);
  const wordCount = body.replace(/\[[^\]]+\]/g, "").split(/\s+/).filter((w) => w.length > 1).length;
  const metaTitle = result.fields["Meta title"] ?? "";
  const metaDesc = result.fields["Meta description"] ?? "";
  const outline = result.fields["Outline"] ?? "";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {/* Stats bar */}
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-4">
        ~{wordCount.toLocaleString()} words in refreshed draft
      </div>

      {/* Meta fields */}
      {(metaTitle || metaDesc) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-5 space-y-1.5">
          {metaTitle && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Meta title ({metaTitle.length}/60)</div>
              <p className="text-[12px] text-slate-700 font-medium mt-0.5">{metaTitle}</p>
            </div>
          )}
          {metaDesc && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Meta description ({metaDesc.length}/160)</div>
              <p className="text-[12px] text-slate-600 italic mt-0.5">{metaDesc}</p>
            </div>
          )}
        </div>
      )}

      {/* Outline */}
      {outline && (
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2.5 mb-5">
          <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest mb-1.5">Page outline</div>
          <pre className="text-[11px] text-indigo-800 font-mono whitespace-pre-wrap leading-relaxed">{outline}</pre>
        </div>
      )}

      {/* Article body */}
      <div
        className="
          text-[13px] text-slate-700 leading-relaxed
          [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-slate-200
          [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-slate-100
          [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:ml-3
          [&_p]:mb-3 [&_p]:leading-relaxed
          [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1
          [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1
          [&_li]:text-[13px]
          [&_strong]:font-semibold [&_strong]:text-slate-900
        "
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  token,
  onApprove,
  approving,
}: {
  item: RefreshItem;
  token: string;
  onApprove: () => void;
  approving: boolean;
}) {
  const { job, result } = item;
  const status = getItemStatus(item);
  const pageType = job.fields.page_type;
  const refreshUrl = job.fields.refresh_url!;
  const keyword = job.fields.target_keyword;
  const wordCountBefore = result?.fields["Source URLs"] ? null : null; // from result metadata if available

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 leading-snug mb-1.5">
              {job.fields["Blog Title"]}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {pageType && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PAGE_TYPE_COLORS[pageType] ?? "bg-slate-100 text-slate-600"}`}>
                  {pageType}
                </span>
              )}
              {keyword && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium max-w-[200px] truncate">
                  {keyword}
                </span>
              )}
              <a
                href={refreshUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 max-w-[220px] truncate"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-2.5 h-2.5 shrink-0">
                  <path d="M8 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9M10 2h4v4M14 2 8 8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {refreshUrl.replace(/^https?:\/\//, "").substring(0, 50)}
              </a>
            </div>
          </div>

          {/* Approve button */}
          {status === "review" && result && (
            <button
              onClick={onApprove}
              disabled={approving}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                  Approve &amp; Publish
                </>
              )}
            </button>
          )}

          {status === "approved" && (
            <span className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-emerald-600">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                <polyline points="2 8 6 12 14 4" />
              </svg>
              Approved — queued to publish
            </span>
          )}

          {status === "running" && (
            <span className="shrink-0 flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
              <div className="w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              content_refresh running…
            </span>
          )}
        </div>
      </div>

      {/* SOP pipeline */}
      <div className="px-6 pt-4 shrink-0">
        <SopPipeline status={status} />
      </div>

      {/* Content — in-progress state */}
      {status === "running" && (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div>
            <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[14px] font-medium text-slate-700 mb-1.5">Refresh in progress</div>
            <p className="text-[13px] text-slate-500 max-w-sm">
              The <code className="text-[11px] font-mono bg-slate-100 px-1 rounded">content_refresh</code> SOP is fetching the live
              page, rewriting it, and expanding sections. This usually takes 2–4 minutes.
            </p>
            <a
              href={refreshUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[12px] text-indigo-600 hover:underline"
            >
              View original page →
            </a>
          </div>
        </div>
      )}

      {/* Content — proposed (title not yet approved) */}
      {status === "proposed" && (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div>
            <div className="text-3xl text-slate-200 mb-3">◆</div>
            <div className="text-[14px] font-medium text-slate-600 mb-1">Refresh not yet approved</div>
            <p className="text-[13px] text-slate-400 max-w-sm">
              This refresh is still in the title proposals queue. Once approved there, the{" "}
              <code className="text-[11px] font-mono">content_refresh</code> SOP will run automatically.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      {(status === "review" || status === "approved") && result && (
        <div className="flex-1 flex min-h-0 border-t border-slate-200 mt-0">
          {/* Left — original */}
          <div className="flex flex-col w-1/2 border-r border-slate-200 min-h-0">
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                  Original page (live)
                </span>
              </div>
            </div>
            <OriginalPanel url={refreshUrl} token={token} />
          </div>

          {/* Right — refreshed */}
          <div className="flex flex-col w-1/2 min-h-0">
            <div className="px-6 py-3 border-b border-slate-100 bg-indigo-50/40 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-widest">
                  Refreshed draft
                </span>
              </div>
            </div>
            <RefreshedPanel result={result} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar list item ─────────────────────────────────────────────────────────

function RefreshListItem({
  item,
  selected,
  onClick,
}: {
  item: RefreshItem;
  selected: boolean;
  onClick: () => void;
}) {
  const status = getItemStatus(item);
  const cfg = STATUS_CONFIG[status];
  const pageType = item.job.fields.page_type;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-colors ${
        selected ? "bg-indigo-50 border-l-2 border-l-indigo-500" : "hover:bg-slate-50 border-l-2 border-l-transparent"
      }`}
    >
      {/* Status + page type */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${cfg.badge}`}>
          {cfg.label}
        </span>
        {pageType && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PAGE_TYPE_COLORS[pageType] ?? "bg-slate-100 text-slate-500"}`}>
            {pageType}
          </span>
        )}
      </div>

      {/* Title */}
      <p className={`text-[13px] font-medium leading-snug line-clamp-2 ${selected ? "text-indigo-900" : "text-slate-800"}`}>
        {item.job.fields["Blog Title"]}
      </p>

      {/* URL */}
      {item.job.fields.refresh_url && (
        <p className="text-[11px] text-slate-400 truncate mt-1">
          {item.job.fields.refresh_url.replace(/^https?:\/\//, "")}
        </p>
      )}
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-8">
      <div>
        <div className="text-3xl text-slate-200 mb-4">◇</div>
        <div className="text-[15px] font-medium text-slate-600 mb-2">No content refreshes yet</div>
        <p className="text-[13px] text-slate-400 max-w-sm">
          Content refreshes are generated when you approve a Refresh proposal in{" "}
          <strong className="text-slate-500">Title Proposals</strong>. The{" "}
          <code className="text-[11px] font-mono bg-slate-100 px-1 rounded">audit_content</code> SOP also identifies
          opportunities during site audits.
        </p>
        <div className="mt-5 text-left bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 max-w-sm mx-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">SOPs involved</div>
          <ul className="space-y-1.5">
            {[
              ["audit_content", "Finds underperforming pages during the audit"],
              ["content_refresh", "Rewrites and expands the live page"],
              ["publish_article_wordpress", "Publishes the approved refresh"],
            ].map(([sop, desc]) => (
              <li key={sop} className="flex items-start gap-2">
                <code className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded px-1 py-0.5 shrink-0">
                  {sop}
                </code>
                <span className="text-[11px] text-slate-500 leading-snug">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function ContentOptimization({
  items,
  token,
}: {
  items: RefreshItem[];
  token: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items.find((i) => getItemStatus(i) === "review")?.job.id ?? items[0]?.job.id ?? null
  );
  const [approving, setApproving] = useState(false);
  const [localItems, setLocalItems] = useState<RefreshItem[]>(items);

  const selectedItem = localItems.find((i) => i.job.id === selectedId) ?? null;

  const handleApprove = useCallback(async () => {
    if (!selectedItem?.result) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/portal/content-optimization?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "approve", resultId: selectedItem.result.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve");
      }
      // Optimistically update local state
      setLocalItems((prev) =>
        prev.map((i) =>
          i.job.id === selectedId
            ? {
                ...i,
                result: i.result
                  ? { ...i.result, fields: { ...i.result.fields, portal_approval: "approved" } }
                  : i.result,
              }
            : i
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [selectedItem, selectedId, token]);

  if (localItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col px-10">
        <EmptyState />
      </div>
    );
  }

  const readyCount = localItems.filter((i) => getItemStatus(i) === "review").length;

  return (
    <div className="flex flex-1 min-h-0" style={{ height: "calc(100vh - 12rem)" }}>
      {/* Left sidebar list */}
      <div className="w-[280px] shrink-0 border-r border-slate-200 flex flex-col bg-white overflow-hidden">
        {/* List header */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
              Pages
            </span>
            {readyCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/60">
                {readyCount} ready
              </span>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {localItems.map((item) => (
            <RefreshListItem
              key={item.job.id}
              item={item}
              selected={selectedId === item.job.id}
              onClick={() => setSelectedId(item.job.id)}
            />
          ))}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
        {selectedItem ? (
          <DetailPanel
            item={selectedItem}
            token={token}
            onApprove={handleApprove}
            approving={approving}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400">
            Select a page to review
          </div>
        )}
      </div>
    </div>
  );
}
