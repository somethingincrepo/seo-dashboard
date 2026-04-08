"use client";

import { useState } from "react";
import type { ChangeFields } from "@/lib/changes";
import { isAwarenessFlag, isInstruction } from "@/lib/portal-labels";
// isInstruction is used by ElementPreview for heading direction detection

// Returns true if a proposed_value is implementation code (JSON-LD, robots.txt rules, etc.)
// rather than human-readable content. These should be collapsed by default.
function isCodeValue(val: string): boolean {
  if (!val) return false;
  const t = val.trim();
  return (
    t.startsWith("{") ||
    t.startsWith("[") ||
    t.startsWith("<script") ||
    // robots.txt / llms.txt style
    t.startsWith("User-agent:") ||
    t.startsWith("# ") && t.includes("\n")
  );
}

// Collapsed code block — shows "View code" by default, expands on click
function CollapsibleCode({ label, code, copyLabel = "Copy" }: { label: string; code: string; copyLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <span className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
        {open ? `Hide ${label}` : `View ${label}`}
      </button>
      {open && (
        <div className="mt-2 relative">
          <pre
            className="text-[11px] font-mono leading-relaxed bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {code}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            {copied ? "Copied!" : copyLabel}
          </button>
        </div>
      )}
    </div>
  );
}

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

interface ChangePreviewProps {
  fields: ChangeFields;
  cat: string;
  type: string;
}

/**
 * Detect if a value looks like internal agent analysis rather than actual page content.
 * Agent notes typically contain metrics, instructions, or analytical language.
 */
function isAgentAnalysis(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return (
    /\d+\s*impressions?\/?mo/i.test(val) ||
    /position\s+\d+/i.test(val) ||
    /\d+\s*clicks?/i.test(val) ||
    /\bctr\b/i.test(val) ||
    lower.includes("content is thin") ||
    lower.includes("crawl budget") ||
    lower.includes("flagged for") ||
    /^(expand|rewrite|add|remove|consolidate|update|noindex)\s+(to|the|all|sub-)/i.test(val) ||
    /\d+-\d+\s*words/i.test(val) ||
    lower.includes("schema markup") ||
    lower.includes("json-ld") ||
    lower.includes("faqpage schema") ||
    lower.includes("missing compliance") ||
    lower.includes("zero or near-zero") ||
    lower.includes("internal links to") ||
    // Heading-specific: agent notes use pipe separators between fields
    /\|\s*(Title|H[1-6]|Page renders)/i.test(val) ||
    lower.includes("page renders as") ||
    lower.includes("no heading tags present") ||
    // Proposed is an instruction / conditional, not a clean heading value
    /^(once|when|after)\s+the\s+/i.test(val.trim()) ||
    lower.includes("drawn from target keywords") ||
    lower.includes("once live page copy") ||
    // Parked/redirect domain flags
    lower.includes("domain appears to be parked") ||
    lower.includes("for-sale") ||
    lower.includes("javascript redirect shell")
  );
}

// Check if a heading value is agent analysis — same as above but specifically
// handles the "(missing)" pattern which is valid shorthand for no H1 present
function isHeadingAgentNote(val: string): boolean {
  if (!val) return false;
  // "(missing)" alone is fine to show; "(missing) | Title: ..." is an agent note
  if (/\|\s*(Title|H[1-6]|Page renders)/i.test(val)) return true;
  return isAgentAnalysis(val);
}

// Extract just the heading text from agent-style values like "H1: Foo | Title: Bar | ..."
function extractCleanHeading(val: string): string | null {
  if (!val) return null;
  // Try to pull just the H1/H2/etc value before the first pipe
  const pipeMatch = val.match(/^(H[1-6]\s*:\s*)?(.*?)\s*\|/i);
  if (pipeMatch) {
    const text = pipeMatch[2].trim();
    if (text && !text.toLowerCase().includes("missing") && text.length > 2) return text;
    return null;
  }
  return null;
}

export function ChangePreview({ fields, cat, type }: ChangePreviewProps) {
  const current = fields.current_value?.trim() || "";
  const proposed = fields.proposed_value?.trim() || "";

  if (!current && !proposed) return null;

  const effectiveProposed = proposed && !isAwarenessFlag(proposed) ? proposed : "";

  // Redirect gets its own special flow card regardless of category
  if (type === "Redirect") {
    return <RedirectPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "On-Page" && type === "Metadata") {
    return <MetadataPreview current={current} proposed={effectiveProposed} pageUrl={fields.page_url} />;
  }
  if (cat === "Technical") {
    // If values are agent analysis, don't show the raw technical cards
    if (isAgentAnalysis(current) && isAgentAnalysis(effectiveProposed)) return null;
    return <TechnicalPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "AI-GEO") {
    if (isAgentAnalysis(current) && isAgentAnalysis(effectiveProposed)) return null;
    return <GeoPreview current={current} proposed={effectiveProposed} />;
  }
  if (cat === "Content" || type === "FAQ") {
    // Content changes often have agent analysis in current/proposed — don't show those
    // Only show the preview if the values look like actual page content
    const currentIsAnalysis = isAgentAnalysis(current);
    const proposedIsAnalysis = isAgentAnalysis(effectiveProposed);
    if (currentIsAnalysis && proposedIsAnalysis) return null;
    if (currentIsAnalysis && !effectiveProposed) return null;
    // If proposed is implementation code (JSON-LD schema), route to TechnicalPreview
    // so it renders collapsed rather than dumping raw JSON into the content panel
    if (isCodeValue(effectiveProposed)) {
      return <TechnicalPreview current={currentIsAnalysis ? "" : current} proposed={effectiveProposed} />;
    }
    return <ContentPreview
      current={currentIsAnalysis ? "" : current}
      proposed={proposedIsAnalysis ? "" : effectiveProposed}
      type={type}
    />;
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
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-sm">
        {from && (
          <div className="text-red-600" style={{ overflowWrap: "anywhere" }}>{from}</div>
        )}
        <div className="text-slate-400 text-center my-2 text-xs">
          ↓ {code}
        </div>
        {to && (
          <div className="text-emerald-600" style={{ overflowWrap: "anywhere" }}>{to}</div>
        )}
      </div>
      {current && !from && (
        <p className="text-xs text-slate-400 mt-2" style={{ overflowWrap: "anywhere" }}>Current: {current}</p>
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

  if (isAwarenessFlag(raw)) {
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

  const proposedFlagged = isAwarenessFlag(proposed);
  const hasProposedContent = proposed.length > 0 && !proposedFlagged;
  const proposedHasStructured = proposedMeta.title || proposedMeta.description;

  // Nothing parseable at all — hide preview entirely
  if (!currentMeta.title && !currentMeta.description && !proposedHasStructured && !hasProposedContent) {
    return null;
  }

  // If proposed has raw text but no structured title/description, show as direction
  if (!proposedHasStructured && hasProposedContent) {
    return (
      <div className="mt-4 space-y-4">
        {currentMeta.title && (
          <MetadataFieldRow label="Page Title" current={currentMeta.title} proposed={null} />
        )}
        {currentMeta.description && (
          <MetadataFieldRow label="Meta Description" current={currentMeta.description} proposed={null} />
        )}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Proposed Direction</div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-sm text-emerald-800 leading-relaxed whitespace-pre-wrap break-words">
              {proposed}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine what's changing vs what's fine
  const hasTitleData = currentMeta.title || proposedMeta.title;
  const hasDescData = currentMeta.description || proposedMeta.description;
  const titleChanging = !!(proposedMeta.title && proposedMeta.title !== currentMeta.title);
  const descChanging = !!(proposedMeta.description && proposedMeta.description !== currentMeta.description);

  return (
    <div className="mt-4 space-y-4">
      {/* Page Title section */}
      {hasTitleData ? (
        <MetadataFieldRow
          label="Page Title"
          current={currentMeta.title}
          proposed={proposedMeta.title}
        />
      ) : hasDescData && !hasTitleData ? (
        /* Only description is in the data — show title as "no change" so client sees the full picture */
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Page Title</div>
          <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
            <div className="text-xs text-slate-400 italic">No changes needed</div>
          </div>
        </div>
      ) : null}

      {/* Meta Description section */}
      {hasDescData ? (
        <MetadataFieldRow
          label="Meta Description"
          current={currentMeta.description}
          proposed={proposedMeta.description}
        />
      ) : hasTitleData && !hasDescData ? (
        /* Only title is in the data — show description as "no change" so client sees the full picture */
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Meta Description</div>
          <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
            <div className="text-xs text-slate-400 italic">No changes needed</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * MetadataFieldRow — renders one metadata field (title OR description)
 * with clear current → proposed layout. No dimming, no ambiguity.
 */
function MetadataFieldRow({
  label,
  current,
  proposed,
}: {
  label: string;
  current: string | null;
  proposed: string | null;
}) {
  const hasChange = proposed && proposed !== current;

  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</div>
      <div className="space-y-2">
        {/* Current value */}
        <div className="bg-red-50 rounded-xl px-4 py-3 border border-l-2 border-red-100 border-l-red-400">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">Current</div>
          {current ? (
            <div className="text-sm leading-relaxed break-words" style={{ overflowWrap: "anywhere" }}>
              {hasChange ? (
                <span className="text-red-700/60 line-through">{current}</span>
              ) : (
                <span className="text-slate-700">{current}</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">Not set</div>
          )}
        </div>

        {/* Proposed value — only show if there's actually a new value */}
        {proposed && (
          <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-l-2 border-emerald-100 border-l-emerald-400">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Proposed</div>
            <div className="text-sm text-emerald-800 leading-relaxed break-words" style={{ overflowWrap: "anywhere" }}>
              {proposed}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Technical: Code-Style Boxes ───────────────────────────────

function TechnicalPreview({ current, proposed }: { current: string; proposed: string }) {
  const proposedIsCode = isCodeValue(proposed);
  const currentIsCode = isCodeValue(current);

  return (
    <div className="mt-4 space-y-3">
      {current && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Current State</div>
            <span className="text-xs text-red-500">✕</span>
          </div>
          {currentIsCode ? (
            <CollapsibleCode label="current code" code={current} />
          ) : (
            <pre className="text-xs font-mono text-red-700 leading-relaxed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {current}
            </pre>
          )}
        </div>
      )}
      {proposed && (
        proposedIsCode ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Implementation Code</div>
              <span className="text-xs text-emerald-600">✓</span>
            </div>
            <p className="text-xs text-slate-500 mb-1">Ready to implement — our team will add this to your site.</p>
            <CollapsibleCode label="code" code={proposed} copyLabel="Copy code" />
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Proposed Fix</div>
              <span className="text-xs text-emerald-600">✓</span>
            </div>
            <pre className="text-xs font-mono text-emerald-700 leading-relaxed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {proposed}
            </pre>
          </div>
        )
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
  const typeLabel = type === "Alt Text" ? "Alt Text" : type === "Heading" ? "Heading" : type;

  // For headings, clean up agent notes before displaying
  let displayCurrent = current;
  let displayProposed = proposed;
  let currentIsMissing = false;
  let proposedIsDirection = false;

  if (type === "Heading") {
    if (isHeadingAgentNote(current)) {
      const extracted = extractCleanHeading(current);
      if (extracted) {
        displayCurrent = extracted;
      } else if (/\(missing\)/i.test(current)) {
        displayCurrent = "";
        currentIsMissing = true;
      } else {
        displayCurrent = "";
      }
    }
    if (isHeadingAgentNote(proposed) || isInstruction(type, proposed)) {
      const extracted = extractCleanHeading(proposed);
      if (extracted) {
        displayProposed = extracted;
      } else {
        // Extract quoted heading from instruction text: add H1: 'Foo Bar'
        const quotedMatch = proposed.match(/['"]([^'"]{10,80})['"]/);
        if (quotedMatch) {
          displayProposed = quotedMatch[1];
        } else {
          proposedIsDirection = true;
        }
      }
    }
  }

  const currentPrefix = displayCurrent ? getElementPrefix(type, displayCurrent) : "";
  const proposedPrefix = displayProposed && !proposedIsDirection ? getElementPrefix(type, displayProposed) : "";
  const suffix = getElementSuffix(type);

  // Nothing useful to show
  if (!displayCurrent && !currentIsMissing && !displayProposed && !proposedIsDirection) return null;

  return (
    <div className="mt-4 space-y-3">
      {(displayCurrent || currentIsMissing) && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Current {typeLabel}</div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            {currentIsMissing || !displayCurrent ? (
              <span className="text-sm text-slate-400 italic">Not set</span>
            ) : type === "Alt Text" ? (
              <code className="text-sm text-slate-700" style={{ overflowWrap: "anywhere" }}>
                <span className="text-slate-400">{currentPrefix}</span>{stripElementPrefix(displayCurrent)}<span className="text-slate-400">{suffix}</span>
              </code>
            ) : (
              <span className="text-sm text-slate-700" style={{ overflowWrap: "anywhere" }}>
                <span className="text-slate-400 text-xs font-mono mr-1">{currentPrefix}</span>{stripElementPrefix(displayCurrent)}
              </span>
            )}
          </div>
        </div>
      )}
      {(displayProposed || proposedIsDirection) && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            {proposedIsDirection ? "Recommendation" : `Updated ${typeLabel}`}
          </div>
          {proposedIsDirection ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-sm text-emerald-800 leading-relaxed" style={{ overflowWrap: "anywhere" }}>{proposed}</p>
            </div>
          ) : (
            <div className="bg-emerald-50 border-l-2 border-emerald-400 border border-emerald-200 rounded-xl px-4 py-3">
              {type === "Alt Text" ? (
                <code className="text-sm text-emerald-800" style={{ overflowWrap: "anywhere" }}>
                  <span className="text-emerald-500">{proposedPrefix}</span>{stripElementPrefix(displayProposed)}<span className="text-emerald-500">{suffix}</span>
                </code>
              ) : (
                <span className="text-sm text-emerald-800" style={{ overflowWrap: "anywhere" }}>
                  <span className="text-emerald-500 text-xs font-mono mr-1">{proposedPrefix}</span>{stripElementPrefix(displayProposed)}
                </span>
              )}
            </div>
          )}
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
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Current Content</div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-sm text-slate-600 leading-relaxed" style={{ overflowWrap: "anywhere" }}>
              {!showFullCurrent && current.length > truncateAt
                ? current.slice(0, truncateAt) + "..."
                : current}
            </p>
            {current.length > truncateAt && (
              <button
                onClick={() => setShowFullCurrent(!showFullCurrent)}
                className="text-xs text-indigo-500 hover:text-indigo-700 mt-2 transition-colors"
              >
                {showFullCurrent ? "Show less" : "Show full text"}
              </button>
            )}
          </div>
        </div>
      )}
      {proposed && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Proposed Content</div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-800 leading-relaxed" style={{ overflowWrap: "anywhere" }}>
              {!showFullProposed && proposed.length > truncateAt
                ? proposed.slice(0, truncateAt) + "..."
                : proposed}
            </p>
            {proposed.length > truncateAt && (
              <button
                onClick={() => setShowFullProposed(!showFullProposed)}
                className="text-xs text-indigo-500 hover:text-indigo-700 mt-2 transition-colors"
              >
                {showFullProposed ? "Show less" : "Show full text"}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Content changes may be visible to site visitors.</p>
        </div>
      )}
    </div>
  );
}

// ─── GEO/AI: Optimization Card ─────────────────────────────────

function GeoPreview({ current, proposed }: { current: string; proposed: string }) {
  return (
    <div className="mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-blue-600">AI Search Optimization</div>
        {current && (
          <p className="text-xs text-slate-500 leading-relaxed" style={{ overflowWrap: "anywhere" }}>Current state: {current}</p>
        )}
        {proposed && (
          <p className="text-sm text-blue-800 leading-relaxed" style={{ overflowWrap: "anywhere" }}>{proposed}</p>
        )}
      </div>
    </div>
  );
}
