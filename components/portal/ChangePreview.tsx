"use client";

import type { ChangeFields } from "@/lib/changes";
import { isAwarenessFlag } from "@/lib/portal-labels";

/**
 * ChangePreview — renders type-appropriate visual previews for the detail panel.
 *
 * Preview type mapping (also documented in agents/sops/README.md Rule 5 and
 * audit agent AGENTS.md "Writing Changes Records" section):
 *
 *   cat === "On-Page" && type === "Metadata"  → Google search result preview
 *   cat === "Technical"                       → Code-style boxes with issue/fix labels
 *   cat === "On-Page" && type !== "Metadata"  → Element comparison (H1, alt text, etc.)
 *   cat === "Content"                         → Element comparison (content-specific)
 *   cat === "AI-GEO"                          → Blue AI citation card
 *
 * The audit agent populates current_value and proposed_value with structured text
 * that these renderers parse. For metadata: "Title Tag: ...\nMeta Description: ..."
 * format. For headings: "H1: ...\nH2: ..." format. For technical: freeform.
 */

interface ChangePreviewProps {
  fields: ChangeFields;
  cat: string;
  type: string;
}

export function ChangePreview({ fields, cat, type }: ChangePreviewProps) {
  const current = fields.current_value?.trim() || "";
  const proposed = fields.proposed_value?.trim() || "";

  if (!current && !proposed) return null;

  // Filter out awareness flags from proposed — they aren't real rewrites
  const effectiveProposed = proposed && !isAwarenessFlag(proposed) ? proposed : "";

  // Route to the correct preview renderer
  if (cat === "On-Page" && type === "Metadata") {
    return <MetadataPreview current={current} proposed={effectiveProposed} pageUrl={fields.page_url} />;
  }
  if (cat === "Technical") {
    return <TechnicalPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "AI-GEO") {
    return <GeoPreview current={current} proposed={effectiveProposed} />;
  }
  // On-Page (non-metadata) and Content both use element comparison
  return <ElementPreview current={current} proposed={effectiveProposed} type={type} />;
}

// ─── Metadata: Google Search Result Preview ────────────────────

function parseMetadataFields(text: string): { title: string; description: string } {
  let title = "";
  let description = "";

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("title tag:") || lower.startsWith("title:")) {
      title = line.replace(/^(title tag|title)\s*:\s*/i, "").trim();
    } else if (lower.startsWith("meta description:") || lower.startsWith("description:")) {
      description = line.replace(/^(meta description|description)\s*:\s*/i, "").trim();
    }
  }

  // If no labeled fields found, try to use the whole text
  if (!title && !description) {
    if (lines.length >= 2) {
      title = lines[0];
      description = lines.slice(1).join(" ");
    } else if (lines.length === 1) {
      title = lines[0];
    }
  }

  return { title, description };
}

function buildBreadcrumb(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return u.hostname;
    const crumbs = parts.slice(0, 2).map(p =>
      p.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    );
    return `${u.hostname} > ${crumbs.join(" > ")}${parts.length > 2 ? " > ..." : ""}`;
  } catch {
    return pageUrl;
  }
}

function MetadataPreview({
  current,
  proposed,
  pageUrl,
}: {
  current: string;
  proposed: string;
  pageUrl: string;
}) {
  const currentMeta = parseMetadataFields(current);
  const proposedMeta = parseMetadataFields(proposed);
  const breadcrumb = buildBreadcrumb(pageUrl);
  const proposedIsFlag = proposed ? isAwarenessFlag(proposed) : false;
  const proposedHasContent = proposedMeta.title || proposedMeta.description;

  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">
            Current Search Appearance
          </div>
          <SearchResultCard
            title={currentMeta.title}
            description={currentMeta.description}
            breadcrumb={breadcrumb}
            variant="current"
          />
        </div>
      )}
      {proposed && !proposedIsFlag && proposedHasContent && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">
            Proposed Search Appearance
          </div>
          <SearchResultCard
            title={proposedMeta.title}
            description={proposedMeta.description}
            breadcrumb={breadcrumb}
            variant="proposed"
          />
        </div>
      )}
    </div>
  );
}

function SearchResultCard({
  title,
  description,
  breadcrumb,
  variant,
}: {
  title: string;
  description: string;
  breadcrumb: string;
  variant: "current" | "proposed";
}) {
  const borderColor = variant === "current" ? "border-l-red-400/30" : "border-l-emerald-400/30";

  return (
    <div className={`bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] border-l-2 ${borderColor}`}>
      {title ? (
        <div className="text-blue-400 text-base font-medium leading-snug" style={{ overflowWrap: "anywhere" }}>
          {title.length > 60 ? title.slice(0, 60) + "..." : title}
        </div>
      ) : (
        <div className="text-white/20 text-sm italic">No title tag</div>
      )}
      <div className="text-emerald-400/60 text-xs mt-1">{breadcrumb}</div>
      {description ? (
        <div className="text-sm text-white/60 mt-1.5 leading-relaxed" style={{ overflowWrap: "anywhere" }}>
          {description.length > 160 ? description.slice(0, 160) + "..." : description}
        </div>
      ) : (
        <div className="text-white/20 text-xs mt-1.5 italic">No description available</div>
      )}
    </div>
  );
}

// ─── Technical: Code-Style Boxes ───────────────────────────────

function TechnicalPreview({
  current,
  proposed,
}: {
  current: string;
  proposed: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div className="relative bg-red-500/[0.04] border border-red-400/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/25">Current</div>
            <span className="text-[10px] text-red-400/70 font-medium">issue</span>
          </div>
          <pre
            className="text-xs font-mono text-white/60 leading-relaxed"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            {current}
          </pre>
        </div>
      )}
      {proposed && (
        <div className="relative bg-emerald-500/[0.04] border border-emerald-400/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/25">Proposed</div>
            <span className="text-[10px] text-emerald-400/70 font-medium">fix</span>
          </div>
          <pre
            className="text-xs font-mono text-emerald-300/70 leading-relaxed"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            {proposed}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── On-Page / Content: Element Comparison ─────────────────────

function detectElementLabel(type: string, text: string): string {
  const lower = text.toLowerCase();
  if (type === "Heading" || lower.startsWith("h1:") || lower.startsWith("h2:")) {
    // Try to extract the heading level
    const match = text.match(/^(H[1-6])\s*:/i);
    if (match) return match[1].toUpperCase();
    return "Heading";
  }
  if (type === "Alt Text") return "Alt text";
  if (type === "FAQ") return "FAQ";
  if (type === "Content") return "Content";
  if (type === "Internal Link") return "Link";
  return type || "Element";
}

function ElementPreview({
  current,
  proposed,
  type,
}: {
  current: string;
  proposed: string;
  type: string;
}) {
  const currentLabel = current ? detectElementLabel(type, current) : "";
  const proposedLabel = proposed ? detectElementLabel(type, proposed) : "";

  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Current</div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3">
            <span className="text-[10px] text-white/30 uppercase tracking-wide mr-2">{currentLabel}:</span>
            <span className="text-sm text-white/60" style={{ overflowWrap: "anywhere" }}>{current.replace(/^(H[1-6]|alt text|heading|content|faq|link)\s*:\s*/i, "")}</span>
          </div>
        </div>
      )}
      {proposed && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Proposed</div>
          <div className="bg-emerald-500/5 border border-emerald-400/10 rounded-xl px-4 py-3">
            <span className="text-[10px] text-emerald-400/50 uppercase tracking-wide mr-2">{proposedLabel}:</span>
            <span className="text-sm text-emerald-300/80" style={{ overflowWrap: "anywhere" }}>{proposed.replace(/^(H[1-6]|alt text|heading|content|faq|link)\s*:\s*/i, "")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GEO/AI: Citation Card ─────────────────────────────────────

function GeoPreview({
  current,
  proposed,
}: {
  current: string;
  proposed: string;
}) {
  return (
    <div className="mt-4">
      <div className="bg-blue-500/[0.04] border border-blue-400/[0.08] rounded-xl p-4 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-blue-400/50">
          AI Search Optimization
        </div>
        {current && (
          <div>
            <div className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Current</div>
            <p className="text-sm text-white/50 leading-relaxed" style={{ overflowWrap: "anywhere" }}>{current}</p>
          </div>
        )}
        {proposed && (
          <div>
            <div className="text-[10px] text-blue-400/50 uppercase tracking-wide mb-1">Proposed</div>
            <p className="text-sm text-blue-300/70 leading-relaxed" style={{ overflowWrap: "anywhere" }}>{proposed}</p>
          </div>
        )}
      </div>
    </div>
  );
}
