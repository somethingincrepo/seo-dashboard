"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { CONTENT_TYPE_CONFIG, type ContentTypeName } from "@/lib/content";

type Title = {
  id: string;
  title: string;
  title_status: string;
  airtable_status: string;
  target_keyword: string;
  keyword_group: string;
  search_intent: string;
  content_angle: string;
  quality_score: number | null;
  proposed_at: string | null;
  approved_at: string | null;
  content_type_name: ContentTypeName | null;
  refresh_url: string | null;
  page_type: string | null;
};

type KeywordGroup = {
  group: string;
  subkeywords: { keyword: string; intent?: string }[];
};

type QuotaState = {
  standard: { used: number; limit: number };
  longform: { used: number; limit: number };
  refresh: { used: number; limit: number };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTENT_STYLES: Record<string, string> = {
  informational: "bg-blue-50 text-blue-700",
  commercial: "bg-amber-50 text-amber-700",
  transactional: "bg-green-50 text-green-700",
};

function IntentBadge({ intent }: { intent: string }) {
  if (!intent) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${INTENT_STYLES[intent] ?? "bg-slate-100 text-slate-600"}`}>
      {intent}
    </span>
  );
}

const QUALITY_LABELS: Record<number, string> = {
  3: "Good — meets minimum quality bar",
  4: "Strong — specific, unique angle",
  5: "Excellent — high specificity + differentiated from SERP",
};

function QualityDots({ score }: { score: number | null }) {
  if (!score) return null;
  return (
    <div className="relative group inline-flex gap-0.5 items-center cursor-default">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= score ? "bg-slate-600" : "bg-slate-200"}`} />
      ))}
      <div className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block pointer-events-none">
        <div className="bg-slate-900 text-white text-[11px] font-medium rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          Quality {score}/5 — {QUALITY_LABELS[score] ?? "Scored by AI"}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuotaBanner
// ---------------------------------------------------------------------------

function QuotaBanner({ quota, packageTier }: { quota: QuotaState; packageTier: PackageTier }) {
  const pkg = PACKAGES[packageTier];
  const rows: { key: ContentTypeName; label: string }[] = [
    { key: "standard", label: "Standard Article" },
    ...(pkg.articles_longform > 0 ? [{ key: "longform" as ContentTypeName, label: "Long-Form Article" }] : []),
    { key: "refresh", label: "Content Refresh" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">Monthly Content Budget</div>
      <div className="flex flex-col gap-2">
        {rows.map(({ key, label }) => {
          const { used, limit } = quota[key];
          const pct = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
          const atLimit = used >= limit;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[12px] text-slate-600 w-36 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${atLimit ? "bg-amber-400" : "bg-slate-700"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-[12px] shrink-0 ${atLimit ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                {atLimit ? `${used}/${limit} · Limit reached` : `${used}/${limit} · ${limit - used} left`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentTypeModal — appears when "Approve…" is clicked
// ---------------------------------------------------------------------------

const PAGE_TYPE_OPTIONS = [
  { value: "Blog Post", label: "Blog Post" },
  { value: "Service Page", label: "Service Page" },
  { value: "Landing Page", label: "Landing Page" },
  { value: "Other", label: "Other" },
];

function ContentTypeModal({
  title,
  quota,
  packageTier,
  onConfirm,
  onCancel,
  busy,
}: {
  title: Title;
  quota: QuotaState;
  packageTier: PackageTier;
  onConfirm: (type: ContentTypeName, refreshUrl?: string, pageType?: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const pkg = PACKAGES[packageTier];

  // Pre-populate from title if it's already a refresh with URL
  const [selectedType, setSelectedType] = useState<ContentTypeName>(title.content_type_name ?? "standard");
  const [refreshUrl, setRefreshUrl] = useState(title.refresh_url ?? "");
  const [pageType, setPageType] = useState(title.page_type ?? "Blog Post");

  const options: { type: ContentTypeName; label: string; desc: string; available: boolean; reason?: string }[] = [
    {
      type: "standard",
      label: "Standard Article",
      desc: CONTENT_TYPE_CONFIG.standard.wordRange,
      available: quota.standard.used < quota.standard.limit,
      reason: quota.standard.used >= quota.standard.limit ? `${quota.standard.limit}/${quota.standard.limit} used this month` : undefined,
    },
    ...(pkg.articles_longform > 0 ? [{
      type: "longform" as ContentTypeName,
      label: "Long-Form Article",
      desc: CONTENT_TYPE_CONFIG.longform.wordRange,
      available: quota.longform.used < quota.longform.limit,
      reason: quota.longform.used >= quota.longform.limit ? `${quota.longform.limit}/${quota.longform.limit} used this month` : undefined,
    }] : []),
    {
      type: "refresh",
      label: "Content Refresh",
      desc: "Rewrite & expand an existing page",
      available: quota.refresh.used < quota.refresh.limit,
      reason: quota.refresh.used >= quota.refresh.limit ? `${quota.refresh.limit}/${quota.refresh.limit} used this month` : undefined,
    },
  ];

  const canConfirm =
    options.find((o) => o.type === selectedType)?.available &&
    (selectedType !== "refresh" || refreshUrl.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-[14px] font-semibold text-slate-800">Choose content type</div>
          <div className="text-[12px] text-slate-400 mt-0.5 truncate">{title.title}</div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2">
          {options.map((opt) => (
            <button
              key={opt.type}
              disabled={!opt.available}
              onClick={() => opt.available && setSelectedType(opt.type)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selectedType === opt.type && opt.available
                  ? "border-slate-900 bg-slate-50"
                  : !opt.available
                  ? "border-slate-100 opacity-40 cursor-not-allowed"
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">{opt.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                </div>
                <div className="text-[11px] text-slate-400 shrink-0 ml-3">
                  {opt.reason ?? `${quota[opt.type].used}/${quota[opt.type].limit} used`}
                </div>
              </div>
            </button>
          ))}

          {/* Refresh-specific fields */}
          {selectedType === "refresh" && (
            <div className="mt-1 flex flex-col gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  URL to refresh <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={refreshUrl}
                  onChange={(e) => setRefreshUrl(e.target.value)}
                  placeholder="https://yoursite.com/page-to-update"
                  className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  Page type
                </label>
                <select
                  value={pageType}
                  onChange={(e) => setPageType(e.target.value)}
                  className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none"
                >
                  {PAGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-[13px] font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(selectedType, selectedType === "refresh" ? refreshUrl.trim() : undefined, selectedType === "refresh" ? pageType : undefined)}
            disabled={!canConfirm || busy}
            className="flex-1 py-2 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal card — fully interactive
// ---------------------------------------------------------------------------

function ProposalCard({
  title,
  keywordGroups,
  token,
  quota,
  packageTier,
  onUpdate,
  onRemove,
  onQuotaHit,
}: {
  title: Title;
  keywordGroups: KeywordGroup[];
  token: string;
  quota: QuotaState;
  packageTier: PackageTier;
  onUpdate: (id: string, changes: Partial<Title>) => void;
  onRemove: (id: string) => void;
  onQuotaHit: (msg: string) => void;
}) {
  const [editTitle, setEditTitle] = useState(title.title);
  const [editKeyword, setEditKeyword] = useState(title.target_keyword);
  const [editGroup, setEditGroup] = useState(title.keyword_group);
  const [expanded, setExpanded] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const groupObj = keywordGroups.find((g) => g.group === editGroup);
  const subkeywords = groupObj?.subkeywords ?? [];

  // All available types at quota?
  const pkg = PACKAGES[packageTier];
  const allAtLimit =
    quota.standard.used >= quota.standard.limit &&
    quota.refresh.used >= quota.refresh.limit &&
    (pkg.articles_longform === 0 || quota.longform.used >= quota.longform.limit);

  const save = useCallback(async (extraFields?: Record<string, unknown>) => {
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: title.id, action: "save", title: editTitle, target_keyword: editKeyword, keyword_group: editGroup, ...extraFields }),
    });
  }, [token, title.id, editTitle, editKeyword, editGroup]);

  const handleApproveClick = () => {
    if (allAtLimit) { onQuotaHit("All content slots are full for this month."); return; }
    setShowTypeModal(true);
  };

  const handleApproveConfirm = async (typeName: ContentTypeName, refreshUrl?: string, pageType?: string) => {
    setBusy(true);
    const res = await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_id: title.id,
        action: "approve",
        title: editTitle,
        target_keyword: editKeyword,
        keyword_group: editGroup,
        content_type_name: typeName,
        refresh_url: refreshUrl,
        page_type: pageType,
      }),
    });
    if (res.status === 409) {
      const data = await res.json() as { message?: string };
      onQuotaHit(data.message ?? "Monthly limit reached.");
      setBusy(false);
      setShowTypeModal(false);
      return;
    }
    onUpdate(title.id, {
      title: editTitle,
      target_keyword: editKeyword,
      keyword_group: editGroup,
      title_status: "approved",
      airtable_status: "Queued",
      content_type_name: typeName,
      refresh_url: refreshUrl ?? title.refresh_url,
      page_type: pageType ?? title.page_type,
    });
    setShowTypeModal(false);
    setBusy(false);
  };

  const handleSkip = async () => {
    setBusy(true);
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: title.id }),
    });
    onRemove(title.id);
    setBusy(false);
  };

  const handleGenerate = async () => {
    if (!suggestion.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/portal/titles/generate?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_title: editTitle, suggestion, keyword: editKeyword, group: editGroup }),
      });
      const data = await res.json() as { title?: string };
      if (data.title) { setEditTitle(data.title); setSuggestion(""); await save({ title: data.title }); }
    } finally { setGenerating(false); }
  };

  return (
    <>
      {showTypeModal && (
        <ContentTypeModal
          title={title}
          quota={quota}
          packageTier={packageTier}
          onConfirm={(type, url, pt) => void handleApproveConfirm(type, url, pt)}
          onCancel={() => setShowTypeModal(false)}
          busy={busy}
        />
      )}
      <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                {editGroup || "No group"}
              </div>
              <textarea
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => void save()}
                rows={editTitle.length > 80 ? 2 : 1}
                className="w-full text-[15px] font-semibold text-slate-900 leading-snug resize-none border-0 p-0 bg-transparent focus:outline-none focus:ring-0 placeholder-slate-300"
                placeholder="Enter title…"
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {editKeyword && <span className="text-[12px] font-medium text-slate-500">{editKeyword}</span>}
                <IntentBadge intent={title.search_intent} />
                {title.content_type_name === "refresh" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">refresh</span>
                )}
                {title.content_type_name === "longform" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium">long-form</span>
                )}
              </div>
              {title.refresh_url && (
                <div className="mt-1.5 text-[11px] text-slate-400 truncate">
                  <span className="font-medium">Refreshing:</span> {title.refresh_url}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <QualityDots score={title.quality_score} />
            </div>
          </div>
          {title.content_angle && (
            <p className="mt-2.5 text-[12px] text-slate-400 italic border-l-2 border-slate-100 pl-3 leading-relaxed">
              {title.content_angle}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          {!expanded ? (
            <div className="flex items-center gap-3">
              {title.content_type_name !== "refresh" && (
                <button onClick={() => setExpanded(true)} className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors">
                  ✦ Suggest a direction and regenerate
                </button>
              )}
              <div className="flex-1" />
              <button onClick={handleSkip} disabled={busy} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                Skip
              </button>
              <button
                onClick={handleApproveClick}
                disabled={busy || allAtLimit}
                title={allAtLimit ? "All content slots are full this month" : undefined}
                className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "Saving…" : allAtLimit ? "Limit reached" : "Approve…"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                autoFocus value={suggestion} onChange={(e) => setSuggestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleGenerate(); } }}
                placeholder="e.g. make it more reassuring, focus on recovery time…"
                rows={2}
                className="w-full text-[13px] text-slate-700 border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">Regenerate for:</span>
                <select value={editGroup} onChange={(e) => { setEditGroup(e.target.value); setEditKeyword(""); }}
                  className="text-[12px] text-slate-600 border border-slate-200 rounded-md px-2 py-0.5 bg-white focus:outline-none">
                  <option value="">Same group</option>
                  {keywordGroups.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
                </select>
                {subkeywords.length > 0 && (
                  <select value={editKeyword} onChange={(e) => setEditKeyword(e.target.value)}
                    className="text-[12px] text-slate-600 border border-slate-200 rounded-md px-2 py-0.5 bg-white focus:outline-none">
                    <option value="">Same keyword</option>
                    {subkeywords.map((sk) => <option key={sk.keyword} value={sk.keyword}>{sk.keyword}</option>)}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setExpanded(false); setSuggestion(""); }} className="text-[12px] text-slate-400 hover:text-slate-600">Cancel</button>
                <div className="flex-1" />
                <button onClick={() => void handleGenerate()} disabled={!suggestion.trim() || generating}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors">
                  {generating ? "Generating…" : "Generate"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Request a Title panel — with content type selector
// ---------------------------------------------------------------------------

const INTENT_OPTIONS = [
  { value: "", label: "Search intent (optional)" },
  { value: "informational", label: "Informational — educate / answer questions" },
  { value: "commercial", label: "Commercial — compare / research options" },
  { value: "transactional", label: "Transactional — convert / drive action" },
];

function AddTitlePanel({
  keywordGroups,
  token,
  packageTier,
  onAdded,
}: {
  keywordGroups: KeywordGroup[];
  token: string;
  packageTier: PackageTier;
  onAdded: (t: Title) => void;
}) {
  const pkg = PACKAGES[packageTier];
  const [contentType, setContentType] = useState<ContentTypeName>("standard");
  const [idea, setIdea] = useState("");
  const [group, setGroup] = useState("");
  const [keyword, setKeyword] = useState("");
  const [intent, setIntent] = useState("");
  const [refreshUrl, setRefreshUrl] = useState("");
  const [pageType, setPageType] = useState("Blog Post");
  const [generated, setGenerated] = useState("");
  const [generating, setBusyGen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  const groupObj = keywordGroups.find((g) => g.group === group);
  const subkeywords = groupObj?.subkeywords ?? [];
  const canGenerate = idea.trim().length > 0 && !!group && contentType !== "refresh";

  const isRefresh = contentType === "refresh";

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setBusyGen(true);
    setGenerated("");
    try {
      const res = await fetch(`/api/portal/titles/generate?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion: idea, keyword, group, search_intent: intent }),
      });
      const data = await res.json() as { title?: string };
      if (data.title) setGenerated(data.title);
    } finally { setBusyGen(false); }
  };

  const handleAdd = async (finalTitle?: string) => {
    const t = (finalTitle ?? generated ?? idea).trim();
    if (!t) return;
    if (isRefresh && !refreshUrl.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/portal/titles?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        target_keyword: keyword,
        keyword_group: group,
        search_intent: intent,
        content_type_name: contentType,
        ...(isRefresh ? { refresh_url: refreshUrl.trim(), page_type: pageType } : {}),
      }),
    });
    const data = await res.json() as { title?: Title };
    if (data.title) {
      onAdded(data.title);
      setIdea(""); setGenerated(""); setGroup(""); setKeyword(""); setIntent("");
      setRefreshUrl(""); setPageType("Blog Post");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    }
    setAdding(false);
  };

  const reset = () => { setGenerated(""); };

  // Type selector tabs
  const typeOptions: { type: ContentTypeName; label: string }[] = [
    { type: "standard", label: "Article" },
    ...(pkg.articles_longform > 0 ? [{ type: "longform" as ContentTypeName, label: "Long-Form" }] : []),
    { type: "refresh", label: "Refresh" },
  ];

  if (generated && !isRefresh) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="bg-indigo-50 rounded-lg px-3 pt-3 pb-2 border border-indigo-100">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Generated title</div>
          <textarea
            autoFocus
            value={generated}
            onChange={(e) => setGenerated(e.target.value)}
            rows={Math.max(3, Math.ceil(generated.length / 30))}
            className="w-full text-[14px] font-semibold text-slate-900 bg-transparent resize-none focus:outline-none leading-snug"
          />
        </div>
        {keyword && (
          <div className="text-[12px] text-slate-500 px-1">
            Keyword: <span className="font-medium text-slate-700">{keyword}</span>
            {intent && <> · <IntentBadge intent={intent} /></>}
          </div>
        )}
        <button
          onClick={() => void handleAdd()}
          disabled={adding || !generated.trim()}
          className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          {adding ? "Adding…" : success ? "Added ✓" : "Add to proposals"}
        </button>
        <button onClick={reset} className="w-full py-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
          ← Try a different direction
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Content type tabs */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {typeOptions.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => { setContentType(type); setGenerated(""); }}
            className={`flex-1 py-1.5 text-[12px] font-medium transition-colors ${
              contentType === type
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isRefresh ? (
        /* Refresh mode */
        <>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              URL to refresh <span className="text-red-400 normal-case font-normal">*required</span>
            </label>
            <input
              type="url"
              value={refreshUrl}
              onChange={(e) => setRefreshUrl(e.target.value)}
              placeholder="https://yoursite.com/page-to-update"
              className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Page type
            </label>
            <select
              value={pageType}
              onChange={(e) => setPageType(e.target.value)}
              className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none"
            >
              {PAGE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              What should be updated or improved?
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe what needs improving — thin sections, outdated content, missing topics, or specific angles to strengthen."
              rows={5}
              className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300 leading-relaxed"
            />
          </div>
          <button
            onClick={() => void handleAdd(idea.trim() || `Content refresh: ${refreshUrl.trim()}`)}
            disabled={adding || !refreshUrl.trim()}
            className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? "Adding…" : success ? "Added ✓" : "Add to proposals"}
          </button>
        </>
      ) : (
        /* Standard / Long-Form mode */
        <>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Topic or idea
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe what this article should cover — the more specific, the better. e.g. a post targeting first-time buyers who have questions about pricing or a common objection your team hears frequently."
              rows={6}
              className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Keyword group
            </label>
            <select
              value={group}
              onChange={(e) => { setGroup(e.target.value); setKeyword(""); }}
              className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none"
            >
              <option value="">— select a group —</option>
              {keywordGroups.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>
          </div>

          {subkeywords.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Target keyword <span className="normal-case font-normal text-slate-300">(optional)</span>
              </label>
              <select
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none"
              >
                <option value="">— pick a keyword —</option>
                {subkeywords.map((sk) => <option key={sk.keyword} value={sk.keyword}>{sk.keyword}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              Search intent <span className="normal-case font-normal text-slate-300">(optional)</span>
            </label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none"
            >
              {INTENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => void handleGenerate()}
              disabled={!canGenerate || generating}
              className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? "Generating…" : "Generate with AI"}
            </button>
            {idea.trim() && (
              <button
                onClick={() => void handleAdd(idea.trim())}
                disabled={adding}
                className="w-full py-2 rounded-lg text-[12px] font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {adding ? "Adding…" : success ? "Added ✓" : "Add as-is (no AI)"}
              </button>
            )}
            {!canGenerate && idea.trim() && !group && (
              <p className="text-[11px] text-slate-400 text-center">Select a keyword group to enable AI generation</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TitlesPage() {
  const params = useParams();
  const token = params.token as string;

  const [titles, setTitles] = useState<Title[]>([]);
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [packageTier, setPackageTier] = useState<PackageTier>("growth");
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/titles?token=${token}`);
      if (!res.ok) throw new Error("Failed to load titles");
      const data = await res.json() as {
        titles: Title[];
        keyword_groups: KeywordGroup[];
        quota: QuotaState | null;
        package: PackageTier;
      };
      setTitles(data.titles);
      setKeywordGroups(data.keyword_groups ?? []);
      setQuota(data.quota ?? null);
      setPackageTier(data.package ?? "growth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading titles");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleUpdate = useCallback((id: string, changes: Partial<Title>) => {
    setTitles((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t));
  }, []);
  const handleRemove = useCallback((id: string) => { setTitles((prev) => prev.filter((t) => t.id !== id)); }, []);
  const handleAdded = useCallback((t: Title) => { setTitles((prev) => [t, ...prev]); }, []);

  const proposals = titles.filter((t) => t.title_status === "titled" || (!t.title_status || t.title_status === "proposals"));

  const standardRemaining = quota ? Math.max(0, quota.standard.limit - quota.standard.used) : null;
  const allSelected = proposals.length > 0 && selected.size === proposals.length;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(proposals.map((p) => p.id)));
  }, [allSelected, proposals]);

  const handleBulkApprove = useCallback(async () => {
    if (selected.size === 0 || !quota || quota.standard.used >= quota.standard.limit) return;
    setBulkApproving(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      if (!quota || quota.standard.used >= quota.standard.limit) break;
      const title = proposals.find((p) => p.id === id);
      if (!title) continue;
      const res = await fetch(`/api/portal/titles?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: id,
          action: "approve",
          title: title.title,
          target_keyword: title.target_keyword,
          keyword_group: title.keyword_group,
          content_type_name: "standard",
        }),
      });
      if (res.status === 409) {
        const data = await res.json() as { message?: string };
        setQuotaError(data.message ?? "Monthly article limit reached.");
        break;
      }
      setQuota((q) => q ? { ...q, standard: { ...q.standard, used: q.standard.used + 1 } } : q);
      setTitles((prev) => prev.map((t) => t.id === id ? { ...t, title_status: "approved", airtable_status: "Queued", content_type_name: "standard" } : t));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
    setBulkApproving(false);
  }, [selected, proposals, token, quota]);

  const standardAtLimit = quota ? quota.standard.used >= quota.standard.limit : false;

  return (
    <div className="flex gap-5 min-h-full">
      {/* Left panel */}
      <div className="w-80 shrink-0">
        <div className="sticky top-8">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <span className="text-[14px] font-semibold text-slate-800">Request a title</span>
              <span className="text-slate-400 text-xl font-light leading-none">+</span>
            </div>
            {!loading && (
              <AddTitlePanel
                keywordGroups={keywordGroups}
                token={token}
                packageTier={packageTier}
                onAdded={handleAdded}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right — proposals */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Title Proposals</h1>
          <p className="text-base text-slate-500 mt-1">Review and approve title proposals.</p>
        </div>

        {loading && <div className="text-slate-400 text-sm">Loading…</div>}
        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>}

        {/* Per-type quota banner */}
        {!loading && quota && <QuotaBanner quota={quota} packageTier={packageTier} />}

        {/* Quota error toast */}
        {quotaError && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[13px] mb-4 bg-red-50 border border-red-200 text-red-700">
            <span>{quotaError}</span>
            <button onClick={() => setQuotaError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}

        {!loading && !error && (
          proposals.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-4">◆</div>
              <div className="font-medium text-slate-500 mb-1">No proposals yet</div>
              <div className="text-sm max-w-xs mx-auto">
                Title proposals are generated after your audit and monthly. Add your own using the panel on the left.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Select-all + bulk approve bar */}
              <div className="flex items-center gap-3 px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-500">
                    {allSelected ? "Deselect all" : selected.size > 0 ? `${selected.size} of ${proposals.length} selected` : `Select all ${proposals.length}`}
                  </span>
                </label>
                {selected.size > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Bulk approves as Standard Article</span>
                    <button
                      onClick={() => void handleBulkApprove()}
                      disabled={bulkApproving || standardAtLimit}
                      title={standardAtLimit ? "Standard article limit reached" : undefined}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {bulkApproving
                        ? "Approving…"
                        : standardAtLimit
                        ? "Limit reached"
                        : standardRemaining !== null && selected.size > standardRemaining
                        ? `Approve ${standardRemaining} remaining`
                        : `Approve ${selected.size} selected`}
                    </button>
                  </div>
                )}
              </div>

              {proposals.map((t) => (
                <ProposalCard
                  key={t.id}
                  title={t}
                  keywordGroups={keywordGroups}
                  token={token}
                  quota={quota ?? { standard: { used: 0, limit: 99 }, longform: { used: 0, limit: 0 }, refresh: { used: 0, limit: 1 } }}
                  packageTier={packageTier}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  onQuotaHit={(msg) => setQuotaError(msg)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
