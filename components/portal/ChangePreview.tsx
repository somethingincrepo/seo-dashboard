"use client";

import { useState } from "react";
import type { ChangeFields } from "@/lib/changes";
import { isAwarenessFlag } from "@/lib/portal-labels";

/**
 * ChangePreview — renders type-appropriate visual previews for the detail panel.
 *
 * Preview type routing (documented in agents/sops/README.md Rule 6):
 *
 *   type === "Redirect"                       → Redirect flow card (from → to)
 *   cat === "On-Page" && type === "Metadata"   → Google search result mockup
 *   cat === "Technical"                        → Code-style boxes with issue/fix labels
 *   cat === "On-Page" (Heading, Alt Text)      → Element comparison with type prefix
 *   cat === "Content" || type === "FAQ"         → Content comparison with truncation
 *   cat === "AI-GEO"                           → Blue AI optimization card
 */

function isFlag(value: string): boolean {
  if (!value || value.trim().length === 0) return true;
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("(no rewrite") ||
    v.startsWith("no rewrite") ||
    v.startsWith("flagged for") ||
    v === "tbd" ||
    v === "n/a" ||
    v === "none" ||
    v.startsWith("review needed")
  );
}

function isInstruction(value: string): boolean {
  return /^(update|add|fix|change|replace|remove|complete|rewrite|optimize|include)\b/i.test(
    value.trim()
  );
}

interface ChangePreviewProps {
  fields: ChangeFields;
  cat: string;
  type: string;
}

export function ChangePreview({ fields, cat, type }: ChangePreviewProps) {
  const current = fields.current_value?.trim() || "";
  const proposed = fields.proposed_value?.trim() || "";

  // eslint-disable-next-line no-console
  console.log("[ChangePreview] proposed_value:", fields.proposed_value);

  if (!current && !proposed) return null;

  const effectiveProposed = proposed && !isFlag(proposed) ? proposed : "";

  // Redirect gets its own special flow card regardless of category
  if (type === "Redirect") {
    return <RedirectPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "On-Page" && type === "Metadata") {
    return <MetadataPreview current={current} proposed={effectiveProposed} pageUrl={fields.page_url} />;
  }
  if (cat === "Technical") {
    return <TechnicalPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "AI-GEO") {
    return <GeoPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "Content" || type === "FAQ") {
    return <ContentPreview current={current} proposed={effectiveProposed} type={type} />;
  }
  // On-Page non-metadata (Heading, Alt Text, Internal Link)
  return <ElementPreview current={current} proposed={effectiveProposed} type={type} />;
}

// ─── Redirect: Flow Card ───────────────────────────────────────

function parseRedirectUrls(proposed: string): { from: string; to: string; code: string } {
  // Try to parse "301 redirect:\n/from\n→ /to" format
  const lines = proposed.split("\n").map(l => l.trim()).filter(Boolean);
  let from = "";
  let to = "";
  let code = "301";

  // Look for redirect code
  const codeMatch = proposed.match(/(301|302|307|308)/);
  if (codeMatch) code = codeMatch[1];

  // Look for arrow pattern
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("→") || line.startsWith("->")) {
      to = line.replace(/^(→|->)\s*/, "").trim();
      if (i > 0 && !lines[i - 1].toLowerCase().includes("redirect")) {
        from = lines[i - 1];
      }
    }
  }

  // Fallback: look for URL-like paths
  if (!from || !to) {
    const urls = lines.filter(l => l.startsWith("/") || l.startsWith("http"));
    if (urls.length >= 2) {
      from = from || urls[0];
      to = to || urls[1];
    } else if (urls.length === 1) {
      to = urls[0];
    }
  }

  return { from, to, code };
}

function RedirectPreview({ current, proposed }: { current: string; proposed: string }) {
  const { from, to, code } = parseRedirectUrls(proposed || current);

  // If we couldn't parse URLs, fall back to technical preview
  if (!from && !to) {
    return <TechnicalPreview current={current} proposed={proposed} />;
  }

  return (
    <div className="mt-4">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 font-mono text-sm">
        {from && (
          <div className="text-red-400/70" style={{ overflowWrap: "anywhere" }}>{from}</div>
        )}
        <div className="text-white/20 text-center my-2 text-xs">
          ↓ {code}
        </div>
        {to && (
          <div className="text-emerald-400/70" style={{ overflowWrap: "anywhere" }}>{to}</div>
        )}
      </div>
      {current && !from && (
        <p className="text-xs text-white/25 mt-2" style={{ overflowWrap: "anywhere" }}>Current: {current}</p>
      )}
    </div>
  );
}

// ─── Metadata: Google Search Result Preview ────────────────────

/**
 * Generate a readable page name from a URL path for use as a fallback title.
 * "/managed-services-provider-chicago/server-virtualization/" → "Server Virtualization"
 */
function titleFromUrl(pageUrl: string): string {
  try {
    const pathname = new URL(pageUrl).pathname.replace(/\/+$/, "");
    if (!pathname) return "Homepage";
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    const cleaned = last
      .replace(/^(agent-core-|page-|post-)/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return cleaned || "Homepage";
  } catch {
    return pageUrl || "Page";
  }
}

function parseMetadata(value: string): { title: string | null; description: string | null } {
  if (!value || value.trim().length === 0) return { title: null, description: null };

  const raw = value.trim();

  if (isFlag(raw)) {
    return { title: null, description: null };
  }

  // Normalize newlines to ". " so regexes can match across lines.
  // "Title Tag: Foo\nMeta Description: Bar" → "Title Tag: Foo. Meta Description: Bar"
  const v = raw.replace(/\s*\n+\s*/g, ". ").replace(/\.\s*\./g, ".");

  // Detect analyst shorthand (single-word assessment, not real content)
  if (v.match(/^Title:\s*(acceptable|too short|ok|good|missing|needs)\s*\.?\s*$/i)) {
    return { title: null, description: null };
  }
  if (v.match(/^Desc:\s*(acceptable|too short|ok|good|generic|missing|boilerplate|needs)\s*\.?\s*$/i)) {
    return { title: null, description: null };
  }

  let title: string | null = null;
  let description: string | null = null;

  // Extract "Title Tag: ..." or "Title: ..." — everything up to the next field label or end
  const titleMatch = v.match(/Title\s*(?:Tag)?\s*[:=]\s*(.+?)(?=\.\s*(?:Meta\s*)?Desc(?:ription)?|$)/i);
  if (titleMatch) {
    const t = titleMatch[1].trim().replace(/\.$/, "");
    if (t.length > 10 && !t.match(/^(acceptable|too short|generic|missing|ok|good|needs)/i)) {
      title = t;
    }
  }

  // Extract "Meta Description: ..." or "Description: ..." or "Desc: ..."
  const descMatch = v.match(/(?:Meta\s*)?Desc(?:ription)?\s*[:=]\s*(.+?)$/i);
  if (descMatch) {
    const d = descMatch[1].trim().replace(/\.$/, "");
    if (d.length > 10 && !d.match(/^(acceptable|too short|generic|missing|boilerplate|ok|good|needs)/i)) {
      description = d;
    }
  }

  // If no structured labels found, classify the raw text
  if (!title && !description) {
    if (v.match(/^(Nav page|Critical)/i)) return { title: null, description: null };

    if (v.length < 80 && !v.match(/^(Title|Desc|Meta)/i)) {
      title = v;
    } else if (v.length >= 80 && !v.match(/[:=]/) && !v.match(/^(Title|Desc|Meta)/i)) {
      description = v;
    } else if (v.length > 20 && !v.match(/[:=]/) && !v.match(/^(Title|Desc|Meta)/i)) {
      title = v;
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

function MetadataPreview({ current, proposed, pageUrl }: { current: string; proposed: string; pageUrl: string }) {
  const currentMeta = parseMetadata(current);
  const proposedMeta = parseMetadata(proposed);
  const breadcrumb = buildBreadcrumb(pageUrl);
  const urlTitle = titleFromUrl(pageUrl);

  const currentTitle = currentMeta.title || urlTitle;
  const currentTitleDimmed = !currentMeta.title;
  const currentDesc = currentMeta.description;

  const proposedFlagged = isFlag(proposed);
  const hasProposedContent = proposed.length > 0 && !proposedFlagged;
  const proposedHasStructured = proposedMeta.title || proposedMeta.description;
  const proposedLabel = isInstruction(proposed) ? "Proposed Direction" : "Proposed Search Appearance";

  // eslint-disable-next-line no-console
  console.log("PROPOSED DEBUG:", {
    proposedValue: proposed,
    isFlag: proposedFlagged,
    parsed: proposedMeta,
    hasProposedContent,
    proposedHasStructured,
    branch: proposedFlagged ? "placeholder" : proposedHasStructured ? "serp-card" : hasProposedContent ? "raw-fallback" : "hidden",
  });

  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Current Search Appearance</div>
        <SearchResultCard
          title={currentTitle}
          titleDimmed={currentTitleDimmed}
          description={currentDesc}
          breadcrumb={breadcrumb}
          variant="current"
        />
      </div>
      {proposedHasStructured ? (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">{proposedLabel}</div>
          <SearchResultCard
            title={proposedMeta.title || currentTitle}
            titleDimmed={!proposedMeta.title}
            description={proposedMeta.description}
            breadcrumb={breadcrumb}
            variant="proposed"
          />
        </div>
      ) : hasProposedContent ? (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">{proposedLabel}</div>
          <div className="bg-emerald-500/[0.03] border border-emerald-400/[0.06] rounded-xl p-4">
            <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
              {proposed}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchResultCard({
  title,
  titleDimmed,
  description,
  breadcrumb,
  variant,
}: {
  title: string;
  titleDimmed: boolean;
  description: string | null;
  breadcrumb: string;
  variant: "current" | "proposed";
}) {
  const borderColor = variant === "current" ? "border-l-red-400/30" : "border-l-emerald-400/30";

  return (
    <div className={`bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] border-l-2 ${borderColor}`}>
      {/* Title — always rendered, never truncated, wraps naturally */}
      <div
        className={`text-blue-400 text-base font-medium break-words whitespace-normal ${titleDimmed ? "opacity-30" : ""}`}
      >
        {title}
      </div>
      <div className="text-emerald-400/60 text-xs mt-1">{breadcrumb}</div>
      {/* Description handling differs by card variant */}
      {description ? (
        <div
          className="text-sm text-white/60 mt-1.5 leading-relaxed"
          style={{ overflowWrap: "anywhere" }}
        >
          {description}
        </div>
      ) : variant === "current" ? (
        /* Current card: show explicit "not set" message */
        <div className="text-white/20 text-xs mt-1.5 italic">No meta description currently set</div>
      ) : null /* Proposed card: if no new description, show nothing */}
    </div>
  );
}

// ─── Technical: Code-Style Boxes ───────────────────────────────

function TechnicalPreview({ current, proposed }: { current: string; proposed: string }) {
  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div className="bg-red-500/[0.03] border border-red-400/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/25">Current State</div>
            <span className="text-xs text-red-400/60">✕</span>
          </div>
          <pre className="text-xs font-mono text-white/60 leading-relaxed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {current}
          </pre>
        </div>
      )}
      {proposed && (
        <div className="bg-emerald-500/[0.03] border border-emerald-400/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/25">Proposed Fix</div>
            <span className="text-xs text-emerald-400/60">✓</span>
          </div>
          <pre className="text-xs font-mono text-emerald-300/70 leading-relaxed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {proposed}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── On-Page: Element Comparison (Heading, Alt Text) ───────────

function stripElementPrefix(text: string): string {
  return text.replace(/^(H[1-6]|alt text|alt|heading|link)\s*[:=]\s*/i, "").trim();
}

function getElementPrefix(type: string, text: string): string {
  if (type === "Heading") {
    const match = text.match(/^(H[1-6])\s*:/i);
    if (match) return match[1].toUpperCase() + ": ";
    return "H1: ";
  }
  if (type === "Alt Text") return "alt=\"";
  return "";
}

function getElementSuffix(type: string): string {
  if (type === "Alt Text") return "\"";
  return "";
}

function ElementPreview({ current, proposed, type }: { current: string; proposed: string; type: string }) {
  const currentPrefix = current ? getElementPrefix(type, current) : "";
  const proposedPrefix = proposed ? getElementPrefix(type, proposed) : "";
  const suffix = getElementSuffix(type);
  const typeLabel = type === "Alt Text" ? "Alt Text" : type === "Heading" ? "Heading" : type;

  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Current {typeLabel}</div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3">
            {type === "Alt Text" ? (
              <code className="text-sm text-white/60" style={{ overflowWrap: "anywhere" }}>
                <span className="text-white/30">{currentPrefix}</span>{stripElementPrefix(current)}<span className="text-white/30">{suffix}</span>
              </code>
            ) : (
              <span className="text-sm text-white/60" style={{ overflowWrap: "anywhere" }}>
                <span className="text-white/30 text-xs font-mono mr-1">{currentPrefix}</span>{stripElementPrefix(current)}
              </span>
            )}
          </div>
        </div>
      )}
      {proposed && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Updated {typeLabel}</div>
          <div className="bg-white/[0.02] border-l-2 border-emerald-400/30 border border-white/[0.06] rounded-xl px-4 py-3">
            {type === "Alt Text" ? (
              <code className="text-sm text-emerald-300/80" style={{ overflowWrap: "anywhere" }}>
                <span className="text-emerald-400/40">{proposedPrefix}</span>{stripElementPrefix(proposed)}<span className="text-emerald-400/40">{suffix}</span>
              </code>
            ) : (
              <span className="text-sm text-emerald-300/80" style={{ overflowWrap: "anywhere" }}>
                <span className="text-emerald-400/40 text-xs font-mono mr-1">{proposedPrefix}</span>{stripElementPrefix(proposed)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Content / FAQ: Content Comparison with Truncation ─────────

function ContentPreview({ current, proposed, type }: { current: string; proposed: string; type: string }) {
  const [showFullCurrent, setShowFullCurrent] = useState(false);
  const [showFullProposed, setShowFullProposed] = useState(false);
  const truncateAt = 200;

  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Current Content</div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3">
            <p className="text-sm text-white/60 leading-relaxed" style={{ overflowWrap: "anywhere" }}>
              {!showFullCurrent && current.length > truncateAt
                ? current.slice(0, truncateAt) + "..."
                : current}
            </p>
            {current.length > truncateAt && (
              <button
                onClick={() => setShowFullCurrent(!showFullCurrent)}
                className="text-xs text-violet-400/60 hover:text-violet-400 mt-2 transition-colors"
              >
                {showFullCurrent ? "Show less" : "Show full text"}
              </button>
            )}
          </div>
        </div>
      )}
      {proposed && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Proposed Content</div>
          <div className="bg-emerald-500/5 border border-emerald-400/10 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-300/80 leading-relaxed" style={{ overflowWrap: "anywhere" }}>
              {!showFullProposed && proposed.length > truncateAt
                ? proposed.slice(0, truncateAt) + "..."
                : proposed}
            </p>
            {proposed.length > truncateAt && (
              <button
                onClick={() => setShowFullProposed(!showFullProposed)}
                className="text-xs text-violet-400/60 hover:text-violet-400 mt-2 transition-colors"
              >
                {showFullProposed ? "Show less" : "Show full text"}
              </button>
            )}
          </div>
          <p className="text-xs text-white/25 mt-2">Content changes may be visible to site visitors.</p>
        </div>
      )}
    </div>
  );
}

// ─── GEO/AI: Optimization Card ─────────────────────────────────

function GeoPreview({ current, proposed }: { current: string; proposed: string }) {
  return (
    <div className="mt-4">
      <div className="bg-blue-500/[0.03] border border-blue-400/[0.06] rounded-xl p-4 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-blue-400/50">AI Search Optimization</div>
        {current && (
          <p className="text-xs text-white/30 leading-relaxed" style={{ overflowWrap: "anywhere" }}>Current state: {current}</p>
        )}
        {proposed && (
          <p className="text-sm text-blue-300/70 leading-relaxed" style={{ overflowWrap: "anywhere" }}>{proposed}</p>
        )}
      </div>
    </div>
  );
}
