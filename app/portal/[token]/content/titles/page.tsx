"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

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
};

type KeywordGroup = {
  group: string;
  subkeywords: { keyword: string; intent?: string }[];
};

type Folder = "proposals" | "queued" | "inprogress" | "published";

// ---------------------------------------------------------------------------
// Categorisation helpers
// ---------------------------------------------------------------------------

function getFolder(t: Title): Folder {
  const ts = t.title_status;
  const st = t.airtable_status;
  if (ts === "published") return "published";
  if (ts === "generating" || st === "In Progress") return "inprogress";
  if (ts === "completed" || st === "Completed") return "inprogress"; // ready for review counts as still in-pipeline
  if (ts === "approved" || st === "Queued") return "queued";
  return "proposals";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function QualityDots({ score }: { score: number | null }) {
  if (!score) return null;
  return (
    <div className="inline-flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= score ? "bg-slate-600" : "bg-slate-200"}`} />
      ))}
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

  const groupObj = keywordGroups.find((g) => g.group === editGroup);
  const subkeywords = groupObj?.subkeywords ?? [];

  const save = useCallback(async (extraFields?: Record<string, unknown>) => {
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: title.id, action: "save", title: editTitle, target_keyword: editKeyword, keyword_group: editGroup, ...extraFields }),
    });
  }, [token, title.id, editTitle, editKeyword, editGroup]);

  const handleApprove = async () => {
    setBusy(true);
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: title.id, action: "approve", title: editTitle, target_keyword: editKeyword, keyword_group: editGroup }),
    });
    onUpdate(title.id, { title: editTitle, target_keyword: editKeyword, keyword_group: editGroup, title_status: "approved", airtable_status: "Queued" });
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
    <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
              {editGroup || "No group"}
            </div>
            <textarea
              ref={textareaRef}
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
            </div>
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
            <button onClick={() => setExpanded(true)} className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors">
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
  );
}

// ---------------------------------------------------------------------------
// Read-only pipeline item (for Queued / In Progress / Published folders)
// ---------------------------------------------------------------------------

const FOLDER_STYLES: Record<Folder, { border: string; badge: string; label: string; dot: string }> = {
  proposals: { border: "border-slate-200", badge: "bg-slate-100 text-slate-500", label: "Proposed", dot: "bg-slate-400" },
  queued: { border: "border-emerald-200", badge: "bg-emerald-50 text-emerald-700", label: "Queued", dot: "bg-emerald-400" },
  inprogress: { border: "border-amber-200", badge: "bg-amber-50 text-amber-700", label: "In Progress", dot: "bg-amber-400" },
  published: { border: "border-teal-200", badge: "bg-teal-50 text-teal-700", label: "Published", dot: "bg-teal-500" },
};

function PipelineItem({ title, folder }: { title: Title; folder: Folder }) {
  const style = FOLDER_STYLES[folder];
  return (
    <div className={`bg-white rounded-xl border ${style.border} px-4 py-3.5`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {title.keyword_group && (
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              {title.keyword_group}
            </div>
          )}
          <p className="text-[15px] font-semibold text-slate-800 leading-snug">{title.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {title.target_keyword && <span className="text-[12px] text-slate-500">{title.target_keyword}</span>}
            <IntentBadge intent={title.search_intent} />
          </div>
          {title.content_angle && (
            <p className="mt-2 text-[12px] text-slate-400 italic leading-relaxed line-clamp-2">{title.content_angle}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
            {style.label}
          </span>
          {title.approved_at && (
            <span className="text-[11px] text-slate-400">{formatDate(title.approved_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Generate Title Panel
// ---------------------------------------------------------------------------

// Always-open, no toggle — form is permanently visible
function AddTitlePanel({ keywordGroups, token, onAdded }: { keywordGroups: KeywordGroup[]; token: string; onAdded: (t: Title) => void }) {
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
      const res = await fetch(`/api/portal/titles/generate?token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestion: idea, keyword, group }) });
      const data = await res.json() as { title?: string };
      if (data.title) setGenerated(data.title);
    } finally { setBusyGen(false); }
  };

  const handleAdd = async (finalTitle?: string) => {
    const t = (finalTitle ?? generated ?? idea).trim();
    if (!t) return;
    setAdding(true);
    const res = await fetch(`/api/portal/titles?token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t, target_keyword: keyword, keyword_group: group }) });
    const data = await res.json() as { title?: Title };
    if (data.title) {
      onAdded(data.title);
      setIdea(""); setGenerated(""); setGroup(""); setKeyword("");
      setSuccess(true); setTimeout(() => setSuccess(false), 2000);
    }
    setAdding(false);
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      {!generated ? (
        <>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. a post about financing options for first-time buyers…"
            rows={5}
            className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300 leading-relaxed"
          />
          <select value={group} onChange={(e) => { setGroup(e.target.value); setKeyword(""); }}
            className="w-full text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none">
            <option value="">Keyword group (optional)</option>
            {keywordGroups.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
          </select>
          {subkeywords.length > 0 && (
            <select value={keyword} onChange={(e) => setKeyword(e.target.value)}
              className="w-full text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none appearance-none">
              <option value="">Target keyword (optional)</option>
              {subkeywords.map((sk) => <option key={sk.keyword} value={sk.keyword}>{sk.keyword}</option>)}
            </select>
          )}
          <button onClick={() => void handleGenerate()} disabled={!canGenerate || generating}
            className="w-full py-2.5 rounded-lg text-[13px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {generating ? "Generating…" : "Generate with AI"}
          </button>
          {idea.trim() && (
            <button onClick={() => void handleAdd(idea.trim())} disabled={adding}
              className="w-full py-2 rounded-lg text-[12px] font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors">
              {adding ? "Adding…" : success ? "Added!" : "Add as-is"}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="bg-indigo-50 rounded-lg px-3 pt-3 pb-2 border border-indigo-100">
            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Generated title</div>
            <textarea autoFocus value={generated} onChange={(e) => setGenerated(e.target.value)}
              rows={Math.max(3, Math.ceil(generated.length / 32))}
              className="w-full text-[14px] font-semibold text-slate-900 bg-transparent resize-none focus:outline-none leading-snug" />
          </div>
          <button onClick={() => void handleAdd()} disabled={adding || !generated.trim()}
            className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors">
            {adding ? "Adding…" : success ? "Added!" : "Add to proposals"}
          </button>
          <button onClick={() => setGenerated("")} className="w-full py-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
            Regenerate with different direction
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder nav
// ---------------------------------------------------------------------------

function FolderNav({ folders, active, onChange }: { folders: { key: Folder; label: string; count: number }[]; active: Folder; onChange: (f: Folder) => void }) {
  return (
    <nav className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Status</p>
      </div>
      {folders.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors ${
            active === f.key
              ? "bg-slate-100 font-semibold text-slate-900"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>{f.label}</span>
          <span className="text-[13px] tabular-nums text-slate-400">{f.count}</span>
        </button>
      ))}
    </nav>
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
  const [activeFolder, setActiveFolder] = useState<Folder>("proposals");

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
  const handleRemove = useCallback((id: string) => { setTitles((prev) => prev.filter((t) => t.id !== id)); }, []);
  const handleAdded = useCallback((t: Title) => { setTitles((prev) => [t, ...prev]); }, []);

  const proposals = titles.filter((t) => getFolder(t) === "proposals");
  const queued = titles.filter((t) => getFolder(t) === "queued");
  const inProgress = titles.filter((t) => getFolder(t) === "inprogress");
  const published = titles.filter((t) => getFolder(t) === "published");

  const FOLDERS: { key: Folder; label: string; count: number }[] = [
    { key: "proposals", label: "Proposals",   count: proposals.length },
    { key: "queued",    label: "Queued",       count: queued.length },
    { key: "inprogress",label: "In Progress",  count: inProgress.length },
    { key: "published", label: "Published",    count: published.length },
  ];

  const activeTitles = { proposals, queued, inprogress: inProgress, published }[activeFolder];

  return (
    <div className="flex gap-5 min-h-full">
      {/* Left panel — wider, always-open form at top, folder nav at bottom */}
      <div className="w-80 shrink-0">
        <div className="sticky top-8 flex flex-col gap-3" style={{ height: "calc(100vh - 5rem - 2rem)" }}>

          {/* Request a title — always open, prominent */}
          {!loading && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
                <span className="text-[14px] font-semibold text-slate-800">Request a title</span>
                <span className="text-slate-400 text-xl font-light leading-none">+</span>
              </div>
              <AddTitlePanel keywordGroups={keywordGroups} token={token} onAdded={handleAdded} />
            </div>
          )}

          {/* Folder nav — pinned to bottom */}
          {!loading && (
            <div className="mt-auto flex flex-col gap-2">
              <FolderNav folders={FOLDERS} active={activeFolder} onChange={setActiveFolder} />
              {queued.length > 0 && (
                <button
                  onClick={() => { router.refresh(); router.push(`/portal/${token}/content`); }}
                  className="w-full text-[12px] font-medium text-indigo-600 hover:text-indigo-700 text-center py-2 bg-indigo-50 rounded-xl border border-indigo-100 transition-colors"
                >
                  View in Pipeline →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right — title list for active folder */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Title Proposals</h1>
          <p className="text-base text-slate-500 mt-1">
            {activeFolder === "proposals" && "Review and approve blog title proposals."}
            {activeFolder === "queued" && "Approved titles waiting to be written."}
            {activeFolder === "inprogress" && "Titles currently being written or ready for your review."}
            {activeFolder === "published" && "Titles that have been published to your site."}
          </p>
        </div>

        {loading && <div className="text-slate-400 text-sm">Loading…</div>}
        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>}

        {!loading && !error && activeTitles.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-4">◆</div>
            <div className="font-medium text-slate-500 mb-1">
              {activeFolder === "proposals" ? "No proposals yet" : `Nothing ${activeFolder === "queued" ? "queued" : activeFolder === "inprogress" ? "in progress" : "published"} yet`}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {activeFolder === "proposals"
            ? proposals.map((t) => (
                <ProposalCard key={t.id} title={t} keywordGroups={keywordGroups} token={token} onUpdate={handleUpdate} onRemove={handleRemove} />
              ))
            : activeTitles.map((t) => (
                <PipelineItem key={t.id} title={t} folder={activeFolder} />
              ))
          }
        </div>
      </div>
    </div>
  );
}
