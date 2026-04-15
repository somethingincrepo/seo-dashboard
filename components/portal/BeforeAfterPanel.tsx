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

// "pass" with a real verified_value = green Verified Live
// "unverified" or [unverified] prefix = amber Pending Confirmation
// proposed_value fallback (no verified_value at all) = amber Intended
function VerificationBadge({ status }: { status: "verified" | "unverified" | "intended" | "none" }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        ✓ Verified Live
      </span>
    );
  }
  if (status === "unverified") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        ~ CDN — Confirming Soon
      </span>
    );
  }
  if (status === "intended") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        ~ Intended — Pending Live Check
      </span>
    );
  }
  return null;
}

function afterColorClass(status: "verified" | "unverified" | "intended") {
  if (status === "verified") return { border: "border-emerald-100", bg: "bg-emerald-50/60", label: "text-emerald-500", text: "text-emerald-800" };
  return { border: "border-amber-100", bg: "bg-amber-50/60", label: "text-amber-500", text: "text-amber-800" };
}

function MetadataPanel({
  before,
  after,
  afterStatus,
}: {
  before: MetadataValue | null;
  after: MetadataValue | null;
  afterStatus: "verified" | "unverified" | "intended";
}) {
  const col = afterColorClass(afterStatus);
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
      <div className={`rounded-lg border ${col.border} ${col.bg} p-3`}>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${col.label} mb-2`}>After</div>
        {after?.title != null && (
          <div className="mb-1.5">
            <div className="text-[10px] text-slate-400 mb-0.5">Title</div>
            <div className={`text-xs ${col.text} font-mono break-words`}>{after.title || <span className="italic opacity-50">(empty)</span>}</div>
          </div>
        )}
        {after?.meta_description != null && (
          <div>
            <div className="text-[10px] text-slate-400 mb-0.5">Description</div>
            <div className={`text-xs ${col.text} font-mono break-words`}>{after.meta_description || <span className="italic opacity-50">(empty)</span>}</div>
          </div>
        )}
        {!after && <div className="text-xs italic opacity-50">No data</div>}
      </div>
    </div>
  );
}

function SimpleBeforeAfter({
  before,
  after,
  afterStatus,
}: {
  before: string | null;
  after: string | null;
  afterStatus: "verified" | "unverified" | "intended";
}) {
  const col = afterColorClass(afterStatus);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">Before</div>
        <div className="text-xs text-red-800 font-mono break-words">
          {before || <span className="italic text-red-300">(not set)</span>}
        </div>
      </div>
      <div className={`rounded-lg border ${col.border} ${col.bg} p-3`}>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${col.label} mb-2`}>After</div>
        <div className={`text-xs ${col.text} font-mono break-words`}>
          {after || <span className="italic opacity-50">(no data)</span>}
        </div>
      </div>
    </div>
  );
}

function RedirectPanel({ before, after, afterStatus }: { before: RedirectValue | null; after: RedirectValue | null; afterStatus: "verified" | "unverified" | "intended" }) {
  const col = afterColorClass(afterStatus);
  const from = after?.from || before?.from || "";
  const to = after?.to || "";
  return (
    <div className={`rounded-lg border ${col.border} ${col.bg} p-3`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${col.label} mb-2`}>Redirect Created</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-2 py-1">{from || "—"}</span>
        <span className="text-slate-400 text-xs">→</span>
        <span className={`text-xs font-mono bg-white border rounded px-2 py-1 ${col.text} border-${col.border}`}>{to || "—"}</span>
        <span className="text-[10px] text-slate-400">301</span>
      </div>
    </div>
  );
}

function StatusPanel({ label, verifiedValue }: { label: string; verifiedValue?: string }) {
  const isUnverified = !verifiedValue || verifiedValue.startsWith("[unverified]");
  return (
    <div className={`rounded-lg border p-3 ${isUnverified ? "border-amber-100 bg-amber-50/60" : "border-emerald-100 bg-emerald-50/60"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isUnverified ? "text-amber-500" : "text-emerald-500"}`}>
        {label}
      </div>
      <div className={`text-xs font-medium ${isUnverified ? "text-amber-700" : "text-emerald-700"}`}>
        {!verifiedValue
          ? "Applied — live confirmation pending"
          : verifiedValue.startsWith("[unverified]")
          ? "Applied — CDN cache clearing, will confirm shortly"
          : "Applied and confirmed live"}
      </div>
    </div>
  );
}

export function BeforeAfterPanel({ change }: BeforeAfterPanelProps) {
  const type = normalizeType(change.fields.type || change.fields.change_type || "");
  const currentValue = change.fields.current_value || "";
  const proposedValue = change.fields.proposed_value || "";
  const rawVerifiedValue = change.fields.verified_value || "";
  const verification = change.fields.verification as string | undefined;

  // Determine what "after" value to display and its confirmation status
  let afterValue = "";
  let afterStatus: "verified" | "unverified" | "intended" = "intended";

  if (rawVerifiedValue && !rawVerifiedValue.startsWith("[unverified]")) {
    // Confirmed live read-back
    afterValue = rawVerifiedValue;
    afterStatus = "verified";
  } else if (rawVerifiedValue.startsWith("[unverified] ")) {
    // CDN-cached — value is proposed but not yet confirmed live
    afterValue = rawVerifiedValue.slice("[unverified] ".length);
    afterStatus = "unverified";
  } else {
    // No verified_value at all — fall back to proposed_value as the "intended" state
    afterValue = proposedValue;
    afterStatus = "intended";
  }

  const badgeStatus = afterStatus === "verified" ? "verified" : afterStatus === "unverified" ? "unverified" : rawVerifiedValue ? "none" as const : "intended";

  if (type === "Metadata") {
    const before = tryParseJSON(currentValue) as MetadataValue | null;
    const after = afterValue ? (tryParseJSON(afterValue) as MetadataValue | null) : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge status={badgeStatus === "none" ? "intended" : badgeStatus} />
        </div>
        <MetadataPanel before={before} after={after} afterStatus={afterStatus} />
      </div>
    );
  }

  if (type === "Heading") {
    const before = currentValue || null;
    const after = afterValue || null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge status={badgeStatus === "none" ? "intended" : badgeStatus} />
        </div>
        <SimpleBeforeAfter before={before} after={after} afterStatus={afterStatus} />
      </div>
    );
  }

  if (type === "Redirect") {
    const before = tryParseJSON(currentValue) as RedirectValue | null;
    const after = afterValue ? (tryParseJSON(afterValue) as RedirectValue | null) : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge status={badgeStatus === "none" ? "intended" : badgeStatus} />
        </div>
        <RedirectPanel before={before} after={after} afterStatus={afterStatus} />
      </div>
    );
  }

  if (type === "Internal Link") {
    const before = (() => {
      const parsed = tryParseJSON(currentValue) as Record<string, string> | null;
      return parsed?.anchor_text ? `"${parsed.anchor_text}" → ${parsed.current_href}` : currentValue || null;
    })();
    const after = afterValue || null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
          <VerificationBadge status={badgeStatus === "none" ? "intended" : badgeStatus} />
        </div>
        <SimpleBeforeAfter before={before} after={after} afterStatus={afterStatus} />
      </div>
    );
  }

  // For Schema, FAQ, GEO, Removal, Content, Alt Text — show status panel only
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

  if (!rawVerifiedValue && !change.fields.implemented_at) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live Change</h3>
        <VerificationBadge status={afterStatus === "verified" ? "verified" : afterStatus === "unverified" ? "unverified" : "intended"} />
      </div>
      <StatusPanel label={label} verifiedValue={rawVerifiedValue} />
    </div>
  );
}
