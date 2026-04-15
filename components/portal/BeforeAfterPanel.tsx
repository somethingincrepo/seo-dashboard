"use client";

import type { Change } from "@/lib/changes";
import { normalizeType } from "@/lib/portal-labels";

interface BeforeAfterPanelProps {
  change: Change;
}

interface MetadataValue {
  title?: string | null;
  meta_description?: string | null;
}

interface RedirectValue {
  from?: string;
  to?: string;
  status?: number;
}

function tryParseJSON(val: string): unknown {
  if (!val?.trim()) return null;
  try {
    return JSON.parse(val.trim());
  } catch {
    return null;
  }
}

function VerificationBadge({ verification, verifiedValue }: { verification?: string; verifiedValue?: string }) {
  if (verification === "pass" && verifiedValue && !verifiedValue.startsWith("[unverified]")) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <span>✓</span> Verified Live
      </span>
    );
  }
  if (verification === "unverified" || verifiedValue?.startsWith("[unverified]")) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <span>~</span> Pending Confirmation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
      — Not Yet Captured
    </span>
  );
}

function MetadataPanel({ before, after }: { before: MetadataValue | null; after: MetadataValue | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">Before</div>
        {before?.title != null && (
          <div className="mb-1.5">
            <div className="text-[10px] text-slate-400 mb-0.5">Title</div>
            <div className="text-xs text-red-800 font-mono break-words">{before.title || <span className="italic text-red-300">(not set)</span>}</div>
          </div>
        )}
        {before?.meta_description != null && (
          <div>
            <div className="text-[10px] text-slate-400 mb-0.5">Description</div>
            <div className="text-xs text-red-800 font-mono break-words">{before.meta_description || <span className="italic text-red-300">(not set)</span>}</div>
          </div>
        )}
        {!before && <div className="text-xs text-red-300 italic">No data captured</div>}
      </div>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">After</div>
        {after?.title != null && (
          <div className="mb-1.5">
            <div className="text-[10px] text-slate-400 mb-0.5">Title</div>
            <div className="text-xs text-emerald-800 font-mono break-words">{after.title || <span className="italic text-emerald-300">(empty)</span>}</div>
          </div>
        )}
        {after?.meta_description != null && (
          <div>
            <div className="text-[10px] text-slate-400 mb-0.5">Description</div>
            <div className="text-xs text-emerald-800 font-mono break-words">{after.meta_description || <span className="italic text-emerald-300">(empty)</span>}</div>
          </div>
        )}
        {!after && <div className="text-xs text-emerald-300 italic">Pending confirmation</div>}
      </div>
    </div>
  );
}

function SimpleBeforeAfter({ before, after, label }: { before: string | null; after: string | null; label: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">Before</div>
        <div className="text-xs text-red-800 font-mono break-words">
          {before || <span className="italic text-red-300">(not set)</span>}
        </div>
      </div>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">After</div>
        <div className="text-xs text-emerald-800 font-mono break-words">
          {after || <span className="italic text-emerald-300">(pending)</span>}
        </div>
      </div>
    </div>
  );
}

function RedirectPanel({ before, after }: { before: RedirectValue | null; after: RedirectValue | null }) {
  const from = after?.from || before?.from || "";
  const to = after?.to || "";
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Redirect Created</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-2 py-1">{from || "—"}</span>
        <span className="text-slate-400 text-xs">→</span>
        <span className="text-xs font-mono text-emerald-700 bg-white border border-emerald-200 rounded px-2 py-1">{to || "—"}</span>
        <span className="text-[10px] text-slate-400">301</span>
      </div>
    </div>
  );
}

function StatusPanel({ label, verifiedValue }: { label: string; verifiedValue?: string }) {
  const isUnverified = verifiedValue?.startsWith("[unverified]");
  return (
    <div className={`rounded-lg border p-3 ${isUnverified ? "border-amber-100 bg-amber-50/60" : "border-emerald-100 bg-emerald-50/60"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isUnverified ? "text-amber-500" : "text-emerald-500"}`}>
        {label}
      </div>
      <div className={`text-xs font-medium ${isUnverified ? "text-amber-700" : "text-emerald-700"}`}>
        {verifiedValue
          ? isUnverified
            ? "Applied — waiting for CDN cache to clear"
            : `Applied${verifiedValue !== "updated" && verifiedValue !== "injected" && verifiedValue !== "noindex" && verifiedValue !== "draft" && verifiedValue !== "unpublished" ? `: ${verifiedValue}` : ""}`
          : "Change applied — live confirmation not yet captured"}
      </div>
    </div>
  );
}

export function BeforeAfterPanel({ change }: BeforeAfterPanelProps) {
  const type = normalizeType(change.fields.type || change.fields.change_type || "");
  const currentValue = change.fields.current_value || "";
  const verifiedValue = change.fields.verified_value || "";
  const verification = change.fields.verification as string | undefined;

  // Clean unverified prefix for display
  const cleanVerifiedValue = verifiedValue.startsWith("[unverified] ")
    ? verifiedValue.slice("[unverified] ".length)
    : verifiedValue;

  if (type === "Metadata") {
    const before = tryParseJSON(currentValue) as MetadataValue | null;
    const after = cleanVerifiedValue ? (tryParseJSON(cleanVerifiedValue) as MetadataValue | null) : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge verification={verification} verifiedValue={verifiedValue} />
        </div>
        <MetadataPanel before={before} after={after} />
      </div>
    );
  }

  if (type === "Heading") {
    const before = currentValue || null;
    const after = cleanVerifiedValue || null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge verification={verification} verifiedValue={verifiedValue} />
        </div>
        <SimpleBeforeAfter before={before} after={after} label="H1 Heading" />
      </div>
    );
  }

  if (type === "Redirect") {
    const before = tryParseJSON(currentValue) as RedirectValue | null;
    const after = cleanVerifiedValue ? (tryParseJSON(cleanVerifiedValue) as RedirectValue | null) : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge verification={verification} verifiedValue={verifiedValue} />
        </div>
        <RedirectPanel before={before} after={after} />
      </div>
    );
  }

  if (type === "Internal Link") {
    const before = (() => {
      const parsed = tryParseJSON(currentValue) as Record<string, string> | null;
      return parsed?.anchor_text ? `"${parsed.anchor_text}" → ${parsed.current_href}` : currentValue || null;
    })();
    const after = cleanVerifiedValue || null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge verification={verification} verifiedValue={verifiedValue} />
        </div>
        <SimpleBeforeAfter before={before} after={after} label="Internal Link" />
      </div>
    );
  }

  // For Schema, FAQ, GEO, Removal, Content, Alt Text — show status panel
  const statusLabels: Record<string, string> = {
    Schema: "Schema Markup",
    FAQ: "FAQ Schema",
    GEO: "llms.txt / AI Optimization",
    Removal: "Page Removed from Index",
    Content: "Content Updated",
    "Alt Text": "Image Alt Text",
    Technical: "Technical Fix",
    Canonical: "Canonical Tag",
  };
  const label = statusLabels[type] || "Change";

  if (!verifiedValue && !change.fields.implemented_at) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
        <VerificationBadge verification={verification} verifiedValue={verifiedValue} />
      </div>
      <StatusPanel label={label} verifiedValue={verifiedValue} />
    </div>
  );
}
