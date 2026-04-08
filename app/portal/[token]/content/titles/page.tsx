"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

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

function IntentBadge({ intent }: { intent: string }) {
  const map: Record<string, string> = {
    informational: "bg-blue-50 text-blue-700",
    commercial: "bg-amber-50 text-amber-700",
    transactional: "bg-green-50 text-green-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${map[intent] ?? "bg-slate-100 text-slate-600"}`}>
      {intent}
    </span>
  );
}

function QualityDots({ score }: { score: number | null }) {
  if (!score) return null;
  return (
    <span className="inline-flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= score ? "bg-slate-700" : "bg-slate-200"}`}
        />
      ))}
    </span>
  );
}

function TitleCard({
  title,
  onApprove,
  onSkip,
}: {
  title: Title;
  onApprove: (id: string, editedTitle: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title.title);
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    await onApprove(title.id, editedTitle);
    setBusy(false);
  };

  const handleSkip = async () => {
    setBusy(true);
    await onSkip(title.id);
    setBusy(false);
  };

  const isApproved = title.title_status === "approved";

  return (
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${isApproved ? "border-green-200 opacity-70" : "border-slate-200"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">
            {title.keyword_group}
          </div>
          {editing && !isApproved ? (
            <textarea
              className="w-full text-base font-semibold text-slate-900 border border-slate-300 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
              rows={2}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
            />
          ) : (
            <p className="text-base font-semibold text-slate-900 leading-snug">
              {isApproved ? title.title : editedTitle}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <QualityDots score={title.quality_score} />
          {isApproved && (
            <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
              Approved
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[12px] text-slate-500">
          <span className="font-medium text-slate-700">{title.target_keyword}</span>
        </span>
        {title.search_intent && <IntentBadge intent={title.search_intent} />}
      </div>

      {/* Angle */}
      {title.content_angle && (
        <p className="text-[12px] text-slate-500 italic border-l-2 border-slate-200 pl-3">
          {title.content_angle}
        </p>
      )}

      {/* Actions */}
      {!isApproved && (
        <div className="flex items-center gap-2 pt-1">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] text-slate-500 hover:text-slate-700 underline"
            >
              Edit title
            </button>
          ) : (
            <button
              onClick={() => { setEditing(false); setEditedTitle(title.title); }}
              className="text-[12px] text-slate-500 hover:text-slate-700 underline"
            >
              Cancel edit
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleSkip}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleApprove}
            disabled={busy || !editedTitle.trim()}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            {busy ? "Saving…" : editing ? "Approve edited" : "Approve"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TitlesPage() {
  const params = useParams();
  const token = params.token as string;

  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/titles?token=${token}`);
      if (!res.ok) throw new Error("Failed to load titles");
      const data = await res.json() as { titles: Title[] };
      setTitles(data.titles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading titles");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = useCallback(async (id: string, editedTitle: string) => {
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: id, title: editedTitle }),
    });
    setTitles((prev) => prev.map((t) => t.id === id ? { ...t, title: editedTitle, title_status: "approved" } : t));
  }, [token]);

  const handleSkip = useCallback(async (id: string) => {
    await fetch(`/api/portal/titles?token=${token}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: id }),
    });
    setTitles((prev) => prev.filter((t) => t.id !== id));
  }, [token]);

  const pending = titles.filter((t) => t.title_status === "titled");
  const approved = titles.filter((t) => t.title_status === "approved");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Title Proposals</h1>
        <p className="text-base text-slate-500 mt-1">
          Review and approve blog title proposals. Approved titles enter the content pipeline automatically.
        </p>
      </div>

      {loading && (
        <div className="text-slate-400 text-sm">Loading proposals…</div>
      )}

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
      )}

      {!loading && !error && pending.length === 0 && approved.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl mb-4 text-slate-300">◆</div>
          <div className="font-medium text-slate-500 mb-2">No title proposals yet</div>
          <div className="text-sm text-slate-400 max-w-xs mx-auto">
            Title proposals are generated after your audit completes and on a monthly basis.
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Awaiting Review — {pending.length}
          </h2>
          <div className="flex flex-col gap-4">
            {pending.map((t) => (
              <TitleCard key={t.id} title={t} onApprove={handleApprove} onSkip={handleSkip} />
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          <h2 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Approved — {approved.length}
          </h2>
          <div className="flex flex-col gap-3">
            {approved.map((t) => (
              <TitleCard key={t.id} title={t} onApprove={handleApprove} onSkip={handleSkip} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
