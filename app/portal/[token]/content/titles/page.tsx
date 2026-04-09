"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

type Title = {
  id: string;
  title: string;
  title_status: string;
  target_keyword: string;
  keyword_group: string;
  search_intent: string;
  content_angle: string;
  quality_score: number | null;
  proposed_at: string | null;
  approved_at: string | null;
};

type KeywordGroup = {
  group: string;
  subkeywords: { keyword: string; intent?: string }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(iso: string | null): string {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupByMonth(titles: Title[]): { label: string; items: Title[] }[] {
  const map = new Map<string, Title[]>();
  for (const t of titles) {
    const label = formatMonth(t.proposed_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(t);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

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

function QualityScore({ score }: { score: number | null }) {
  const [hovered, setHovered] = useState(false);
  if (!score) return null;

  const labels = ["Poor", "Below average", "Acceptable", "Good", "Excellent"];
  const label = labels[(score - 1)] ?? "";

  return (
    <div className="relative inline-flex items-center gap-1.5" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span className="text-[11px] font-medium text-slate-400">Quality</span>
      <div className="inline-flex gap-0.5 items-center cursor-default">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= score ? "bg-slate-700" : "bg-slate-200"}`} />
        ))}
      </div>
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-56 bg-slate-900 text-white text-[11px] rounded-lg p-3 shadow-lg pointer-events-none">
          <p className="font-semibold mb-1">{score}/5 — {label}</p>
          <p className="text-slate-300 leading-relaxed">Scored on specificity, uniqueness, length (8–15 words), absence of anti-patterns, and tone fit for your industry.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title Card
// ---------------------------------------------------------------------------

function TitleCard({
  title,
  keywordGroups,
  token,
  onUpdate,
  onRemove,
}: {
  title: Title;
  keywordGroups: KeywordGroup[];
  token: string;
  onUpdate: (id: string, changes: Partial<Title>) => void;
  onRemove: (id: string) => void;
}) {
  const [editTitle, setEditTitle] = useState(title.title);
  const [editKeyword, setEditKeyword] = useState(title.target_keyword);
  const [editGroup, setEditGroup] = useState(title.keyword_group);
  const [expanded, setExpanded] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isApproved = title.title_status === "approved";

  // Subkeywords for the selected group
  const groupObj = keywordGroups.find((g) => g.group === editGroup);
  const subkeywords = groupObj?.subkeywords ?? [];

  const save = useCallback(async (extraFields?: Record<string, unknown>) => {
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_id: title.id,
        action: "save",
        title: editTitle,
        target_keyword: editKeyword,
        keyword_group: editGroup,
        ...extraFields,
      }),
    });
  }, [token, title.id, editTitle, editKeyword, editGroup]);

  const handleApprove = async () => {
    setBusy(true);
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_id: title.id,
        action: "approve",
        title: editTitle,
        target_keyword: editKeyword,
        keyword_group: editGroup,
      }),
    });
    onUpdate(title.id, { title: editTitle, target_keyword: editKeyword, keyword_group: editGroup, title_status: "approved" });
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
        body: JSON.stringify({
          current_title: editTitle,
          suggestion,
          keyword: editKeyword,
          group: editGroup,
        }),
      });
      const data = await res.json() as { title?: string };
      if (data.title) {
        setEditTitle(data.title);
        setSuggestion("");
        await save({ title: data.title });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border transition-shadow ${isApproved ? "border-green-200" : "border-slate-200 hover:shadow-sm"}`}>
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Group label */}
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              {editGroup || "No group"}
            </div>

            {/* Editable title */}
            {!isApproved ? (
              <textarea
                ref={textareaRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => void save()}
                rows={editTitle.length > 80 ? 2 : 1}
                className="w-full text-[15px] font-semibold text-slate-900 leading-snug resize-none border-0 p-0 bg-transparent focus:outline-none focus:ring-0 placeholder-slate-300"
                placeholder="Enter title…"
              />
            ) : (
              <p className="text-[15px] font-semibold text-slate-900 leading-snug">{editTitle}</p>
            )}

            {/* Keyword + intent row — read-only display */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {editKeyword && <span className="text-[12px] font-medium text-slate-500">{editKeyword}</span>}
              <IntentBadge intent={title.search_intent} />
            </div>
          </div>

          {/* Right col: quality + status */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <QualityScore score={title.quality_score} />
            {isApproved && (
              <span className="text-[11px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                Approved
              </span>
            )}
          </div>
        </div>

        {/* Angle */}
        {title.content_angle && (
          <p className="mt-2.5 text-[12px] text-slate-400 italic border-l-2 border-slate-100 pl-3 leading-relaxed">
            {title.content_angle}
          </p>
        )}

      </div>

      {/* Suggestion / actions bar */}
      {!isApproved && (
        <div className="border-t border-slate-100 px-4 py-3">
          {!expanded ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExpanded(true)}
                className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors"
              >
                ✦ Suggest a direction and regenerate
              </button>
              <div className="flex-1" />
              <button onClick={handleSkip} disabled={busy} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                Skip
              </button>
              <button onClick={handleApprove} disabled={busy} className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors">
                {busy ? "Saving…" : "Approve"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                autoFocus
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleGenerate(); } }}
                placeholder="e.g. make it more reassuring, focus on recovery time, target anxious first-time patients…"
                rows={2}
                className="w-full text-[13px] text-slate-700 border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300"
              />
              {/* Group / keyword selectors — only shown here, in the regenerate panel */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">Regenerate for:</span>
                <select
                  value={editGroup}
                  onChange={(e) => { setEditGroup(e.target.value); setEditKeyword(""); }}
                  className="text-[12px] text-slate-600 border border-slate-200 rounded-md px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                  <option value="">Same group</option>
                  {keywordGroups.map((g) => (
                    <option key={g.group} value={g.group}>{g.group}</option>
                  ))}
                </select>
                {subkeywords.length > 0 && (
                  <select
                    value={editKeyword}
                    onChange={(e) => setEditKeyword(e.target.value)}
                    className="text-[12px] text-slate-600 border border-slate-200 rounded-md px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="">Same keyword</option>
                    {subkeywords.map((sk) => (
                      <option key={sk.keyword} value={sk.keyword}>{sk.keyword}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setExpanded(false); setSuggestion(""); }} className="text-[12px] text-slate-400 hover:text-slate-600">
                  Cancel
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => void handleGenerate()}
                  disabled={!suggestion.trim() || generating}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                >
                  {generating ? "Generating…" : "Generate"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Generate Title Panel
// ---------------------------------------------------------------------------

function AddTitlePanel({
  keywordGroups,
  token,
  onAdded,
}: {
  keywordGroups: KeywordGroup[];
  token: string;
  onAdded: (t: Title) => void;
}) {
  const [idea, setIdea] = useState("");
  const [group, setGroup] = useState("");
  const [keyword, setKeyword] = useState("");
  const [generated, setGenerated] = useState("");
  const [generating, setBusyGen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  const groupObj = keywordGroups.find((g) => g.group === group);
  const subkeywords = groupObj?.subkeywords ?? [];

  const canGenerate = idea.trim().length > 0 && !!group;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setBusyGen(true);
    setGenerated("");
    try {
      const res = await fetch(`/api/portal/titles/generate?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion: idea, keyword, group }),
      });
      const data = await res.json() as { title?: string };
      if (data.title) setGenerated(data.title);
    } finally {
      setBusyGen(false);
    }
  };

  const handleAdd = async () => {
    const finalTitle = generated || idea;
    if (!finalTitle.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/portal/titles?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: finalTitle, target_keyword: keyword, keyword_group: group }),
    });
    const data = await res.json() as { title?: Title };
    if (data.title) {
      onAdded(data.title);
      setIdea("");
      setGenerated("");
      setGroup("");
      setKeyword("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
    setAdding(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-slate-100">
        <h3 className="text-[13px] font-semibold text-slate-800">Request a title</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Describe an idea or topic — we&apos;ll generate a proper title.</p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {/* Idea input */}
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. make one about braces for teens, or comparing implants vs dentures…"
          rows={3}
          className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300"
        />

        {/* Group + keyword */}
        <div className="flex flex-col gap-2">
          <select
            value={group}
            onChange={(e) => { setGroup(e.target.value); setKeyword(""); }}
            className="w-full text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300 appearance-none"
          >
            <option value="">Keyword group (optional)</option>
            {keywordGroups.map((g) => (
              <option key={g.group} value={g.group}>{g.group}</option>
            ))}
          </select>
          {subkeywords.length > 0 && (
            <select
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300 appearance-none"
            >
              <option value="">Target keyword (optional)</option>
              {subkeywords.map((sk) => (
                <option key={sk.keyword} value={sk.keyword}>{sk.keyword}</option>
              ))}
            </select>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || generating}
          className="w-full py-2 rounded-lg text-[12px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
        >
          {generating ? "Generating…" : "Generate title"}
        </button>
        {!canGenerate && (
          <p className="text-[11px] text-slate-400 text-center -mt-1">
            {!idea.trim() ? "Add a description" : "Select a keyword group"}
          </p>
        )}

        {/* Generated preview + edit */}
        {generated && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="bg-indigo-50 rounded-lg px-3 pt-3 pb-2 border border-indigo-100">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Generated title</span>
              </div>
              <textarea
                autoFocus
                value={generated}
                onChange={(e) => setGenerated(e.target.value)}
                rows={Math.max(3, Math.ceil(generated.length / 38))}
                className="w-full text-[14px] font-semibold text-slate-900 bg-transparent resize-none focus:outline-none leading-snug"
              />
              <p className="text-[10px] text-indigo-400 mt-1">{group} / {keyword}</p>
            </div>
            <button
              onClick={() => void handleAdd()}
              disabled={adding || !generated.trim()}
              className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              {adding ? "Adding…" : success ? "Added!" : "Add to proposals"}
            </button>
            <button
              onClick={() => setGenerated("")}
              className="w-full py-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              Regenerate with different direction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TitlesPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [titles, setTitles] = useState<Title[]>([]);
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/titles?token=${token}`);
      if (!res.ok) throw new Error("Failed to load titles");
      const data = await res.json() as { titles: Title[]; keyword_groups: KeywordGroup[] };
      setTitles(data.titles);
      setKeywordGroups(data.keyword_groups ?? []);
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

  const handleRemove = useCallback((id: string) => {
    setTitles((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAdded = useCallback((t: Title) => {
    setTitles((prev) => [t, ...prev]);
  }, []);

  const pending = titles.filter((t) => t.title_status === "titled");
  const approved = titles.filter((t) => t.title_status === "approved");
  const pendingGroups = groupByMonth(pending);
  const approvedGroups = groupByMonth(approved);

  return (
    <div className="flex gap-6 min-h-full">
      {/* Left panel */}
      <div className="w-72 shrink-0">
        <div className="sticky top-8 flex flex-col gap-4">
          <AddTitlePanel keywordGroups={keywordGroups} token={token} onAdded={handleAdded} />

          {/* Stats */}
          {!loading && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Overview</p>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">Awaiting review</span>
                <span className="font-semibold text-slate-900">{pending.length}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">Approved</span>
                <span className="font-semibold text-green-700">{approved.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: title list */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Title Proposals</h1>
          <p className="text-base text-slate-500 mt-1">
            Review, edit, and approve blog titles. Approved titles enter the content pipeline automatically.
          </p>
        </div>

        {loading && <div className="text-slate-400 text-sm">Loading proposals…</div>}
        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>}

        {!loading && !error && pending.length === 0 && approved.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-4">◆</div>
            <div className="font-medium text-slate-500 mb-1">No proposals yet</div>
            <div className="text-sm max-w-xs mx-auto">
              Title proposals are generated after your audit and monthly. Add your own using the panel on the left.
            </div>
          </div>
        )}

        {/* Pending — grouped by month */}
        {pendingGroups.map(({ label, items }) => (
          <div key={label} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">{label}</h2>
              <span className="text-[11px] text-slate-400">{items.length} proposal{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-col gap-3">
              {items.map((t) => (
                <TitleCard
                  key={t.id}
                  title={t}
                  keywordGroups={keywordGroups}
                  token={token}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Approved */}
        {approved.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                Approved — {approved.length}
              </h2>
              <button
                onClick={() => { router.refresh(); router.push(`/portal/${token}/content`); }}
                className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                View in Pipeline →
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {approvedGroups.flatMap(({ items }) =>
                items.map((t) => (
                  <TitleCard
                    key={t.id}
                    title={t}
                    keywordGroups={keywordGroups}
                    token={token}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
