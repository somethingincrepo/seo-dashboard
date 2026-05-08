"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/clients";
import {
  resolveGuideForChange,
  type DeliverableType,
  type GuideEntry,
} from "@/lib/implementation-guides";
import { GuideStepList, type GuideValueBag } from "./GuideStepList";

interface ImplementationGuideProps {
  deliverable: DeliverableType;
  client: Client;
  token: string;                  // portal token (required for Mark as Implemented endpoint auth)
  // Either pass a `change` (for approval-flow deliverables) or a `values` bag
  // (for synthetic deliverables like full_article_publish where the source isn't a Change).
  change?: { id: string; fields: Record<string, unknown> };
  values?: GuideValueBag;
  changeId?: string;             // explicit when not passing `change`
  // What to do when "Mark as Implemented" is clicked. Defaults to calling /api/changes/mark-implemented.
  onImplemented?: () => void | Promise<void>;
  onDeferred?: () => void;
  variant?: "inline" | "panel";  // panel = padded card, inline = bare
  hideHeader?: boolean;
  preset?: GuideEntry;            // skip resolution, render this directly (used by re-entry / article publish)
}

export function ImplementationGuide({
  deliverable,
  client,
  token,
  change,
  values,
  changeId,
  onImplemented,
  onDeferred,
  variant = "panel",
  hideHeader,
  preset,
}: ImplementationGuideProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve guide entry (or use preset)
  let entry: GuideEntry;
  let modeReason = "";
  if (preset) {
    entry = preset;
  } else {
    const resolved = resolveGuideForChange(deliverable, client, {
      client_self_implement: change?.fields.client_self_implement === true,
    });
    entry = resolved.entry;
    modeReason = resolved.reason;
  }

  // Build the value bag.
  // - If `values` is passed explicitly, use it.
  // - Otherwise pull from change.fields and stringify.
  const bag: GuideValueBag = values ?? (() => {
    const out: GuideValueBag = {};
    if (change) {
      for (const [k, v] of Object.entries(change.fields)) {
        if (v == null) continue;
        out[k] = String(v);
      }
    }
    return out;
  })();

  const targetId = changeId ?? change?.id;

  async function handleMarkImplemented() {
    if (onImplemented) {
      await onImplemented();
      return;
    }
    if (!targetId) {
      setError("Cannot mark implemented — no change ID.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/changes/mark-implemented", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: targetId, token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      setFeedback("Marked as implemented. Nice work.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const wrapperClass = variant === "panel"
    ? "rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    : "space-y-4";

  return (
    <div className={wrapperClass} data-testid="implementation-guide">
      {!hideHeader && (
        <div>
          <div className="text-[11px] font-bold tracking-widest text-emerald-600 uppercase mb-1">
            Implementation step
          </div>
          <h3 className="text-base font-semibold text-slate-900">{entry.title}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span>~{entry.estimatedMinutes} min</span>
            {modeReason && <span className="text-slate-400">· {modeReason}</span>}
          </div>
          {entry.prerequisites && entry.prerequisites.length > 0 && (
            <div className="mt-3 text-xs text-slate-600">
              <span className="font-semibold">Before you start: </span>
              {entry.prerequisites.join(" · ")}
            </div>
          )}
        </div>
      )}

      <GuideStepList steps={entry.steps} values={bag} />

      {error && (
        <div className="text-sm text-red-600 px-3 py-2 rounded-md bg-red-50 border border-red-200">
          {error}
        </div>
      )}
      {feedback && (
        <div className="text-sm text-emerald-700 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200">
          {feedback}
        </div>
      )}

      {!feedback && (onImplemented || targetId) && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleMarkImplemented}
            disabled={submitting}
            className="flex-[2] py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Mark as Implemented
          </button>
          {onDeferred && (
            <button
              onClick={onDeferred}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I&apos;ll do this later
            </button>
          )}
        </div>
      )}
    </div>
  );
}
