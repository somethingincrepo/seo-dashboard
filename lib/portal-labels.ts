import type { ChangeFields } from "./changes";

// ─── Change Type Display ───────────────────────────────────────
// Maps Airtable `type` field to human-readable UI strings

const CHANGE_TITLES: Record<string, string> = {
  "Metadata": "Update page title & description",
  "Heading": "Improve page headings",
  "Schema": "Add structured data for search",
  "Content": "Update page content",
  "FAQ": "Add FAQ section",
  "Redirect": "Fix broken or outdated link",
  "Internal Link": "Improve internal linking",
  "Canonical": "Fix duplicate page signal",
  "GEO": "Optimize for AI search engines",
  "Alt Text": "Add image descriptions",
  "Removal": "Remove outdated content",
};

export function getChangeTitle(type: string, pageUrl: string): string {
  return CHANGE_TITLES[type] || type || "SEO improvement";
}

const ACTION_VERBS: Record<string, string> = {
  "Metadata": "Update meta tags",
  "Heading": "Fix headings",
  "Schema": "Add schema markup",
  "Content": "Update content",
  "FAQ": "Add FAQ section",
  "Redirect": "Fix redirect",
  "Internal Link": "Fix internal links",
  "Canonical": "Fix canonical",
  "GEO": "Optimize for AI search",
  "Alt Text": "Add image alt text",
  "Removal": "Remove content",
};

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url || "/";
  }
}

/**
 * Extract a readable page name from a URL slug.
 * "/managed-services-provider-chicago/agent-core-two-factor-authentication/"
 * → "Two Factor Authentication"
 * Falls back to cleaned-up last segment or "Homepage" for "/".
 */
function extractPageName(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '') return 'Homepage';
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    // Remove common prefixes/noise words in slugs
    const cleaned = last
      .replace(/^(agent-core-|page-|post-)/i, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    return cleaned || 'Homepage';
  } catch {
    return url || 'Page';
  }
}

export function getListItemTitle(
  type: string,
  pageUrl: string,
  truncateAt?: number,
  changeTitle?: string,
  /** If true, return short title with readable page name instead of full path */
  shortTitle?: boolean
): string {
  if (changeTitle?.trim()) return changeTitle.trim();
  const action = ACTION_VERBS[type] || `Update ${type.toLowerCase()}`;
  if (shortTitle) {
    const pageName = extractPageName(pageUrl);
    return `${action} — ${pageName}`;
  }
  let path = extractPath(pageUrl);
  if (truncateAt && path.length > truncateAt) {
    path = path.slice(0, truncateAt - 3) + "...";
  }
  return `${action} on ${path}`;
}

// ─── Impact Labels ─────────────────────────────────────────────

export function getImpactLabel(type: string): string {
  const map: Record<string, string> = {
    "Metadata": "Search results appearance",
    "Redirect": "Redirect — URL change",
    "GEO": "AI search visibility",
    "Schema": "No visual change",
    "Canonical": "No visual change",
    "Alt Text": "No visual change",
    "Removal": "No visual change",
    "Content": "Visible content change",
    "Heading": "Visible content change",
    "FAQ": "Visible content change",
    "Internal Link": "Visible content change",
  };
  return map[type] || "SEO improvement";
}

// ─── Category Explanations ─────────────────────────────────────
// Shown as fallback in "Why It Matters" when no specific reasoning exists

export const CATEGORY_EXPLANATIONS: Record<string, string> = {
  "Technical": "Technical SEO fixes help search engines crawl and understand your site correctly. These changes don't affect what visitors see on your pages.",
  "On-Page": "On-page changes improve how your content appears to both search engines and visitors. Some changes may be visible on the page.",
  "Content": "Content updates help your pages better answer the questions your potential customers are searching for.",
  "AI-GEO": "AI search optimization helps your brand appear when people use AI assistants like ChatGPT, Perplexity, or Google AI Overviews to research solutions.",
};

export const QUICK_WIN_EXPLANATION = "Quick wins are safe changes with no visual impact on your site. They improve technical SEO signals without changing anything your visitors see.";

export function getConfidenceLabel(confidence: string): string {
  const map: Record<string, string> = { "High": "High confidence", "Medium": "Medium confidence", "Low": "Lower confidence" };
  return map[confidence] || confidence;
}

// ─── Field Resolution Layer ────────────────────────────────────
// Central place to resolve which Airtable field → which UI section.
// Any new Airtable field added later only needs updating here.

/**
 * "What We Recommend" — the client-friendly description.
 * Priority: plain_english_explanation > proposed_value (if readable) > type-based fallback
 */
/**
 * Detect if a proposed_value is just a flag/awareness note rather than a real rewrite.
 */
/**
 * Detect if a proposed_value is a direction/instruction rather than final copy.
 * Used for labeling ("Proposed Direction" vs "Proposed Search Appearance"),
 * NOT for hiding content.
 */
export function isInstruction(type: string, value: string): boolean {
  if (!value) return false;
  return /^(update|add|fix|change|replace|remove|complete|rewrite|optimize|include)\b/i.test(
    value.trim()
  );
}

export function isAwarenessFlag(val: string): boolean {
  if (!val || val.trim().length === 0) return true;
  const lower = val.trim().toLowerCase();
  return (
    lower.startsWith("(no rewrite") ||
    lower.startsWith("no rewrite") ||
    lower.startsWith("flagged for") ||
    lower === "tbd" ||
    lower === "n/a" ||
    lower === "none" ||
    lower.startsWith("review needed") ||
    lower.startsWith("no change proposed") ||
    lower.startsWith("no fix proposed") ||
    lower.startsWith("awareness only")
  );
}

export function getWhatWeRecommend(fields: ChangeFields): string {
  // 1. Best: dedicated client-facing field populated by audit agent
  if (fields.plain_english_explanation?.trim()) {
    return fields.plain_english_explanation;
  }
  // 2. Good: proposed_value if it looks human-readable and is a real recommendation (not a flag)
  if (fields.proposed_value?.trim()) {
    const val = fields.proposed_value.trim();
    if (!val.startsWith("<") && !val.startsWith("{") && val.length > 20 && !isAwarenessFlag(val)) {
      return val;
    }
  }
  // 3. Fallback: if proposed_value is a flag/awareness item, say so honestly
  if (fields.proposed_value?.trim() && isAwarenessFlag(fields.proposed_value)) {
    return getAwarenessDescription(fields.type);
  }
  // 4. Generic fallback
  return getGenericDescription(fields.type);
}

/**
 * "Why It Matters" — business value explanation.
 * Priority: business_impact_explanation > reasoning (filtered) > category fallback
 */
export function getWhyItMatters(fields: ChangeFields): string {
  // 1. Best: dedicated business impact field
  if (fields.business_impact_explanation?.trim()) {
    return fields.business_impact_explanation;
  }
  // 2. Good: reasoning if it looks client-appropriate (not agent jargon)
  if (fields.reasoning?.trim()) {
    const r = fields.reasoning.trim();
    // Filter out obviously internal agent notes
    if (!r.startsWith("[") && !r.startsWith("SOP") && r.length > 15) {
      return r;
    }
  }
  // 3. No generic fallback — return empty so section hides when no real data exists
  return "";
}

/**
 * "Technical Details — Current" — the raw current value on the live page.
 * Always from `current_value`. Hidden if empty.
 */
export function getTechnicalCurrent(fields: ChangeFields): string | null {
  return fields.current_value?.trim() || null;
}

/**
 * "Technical Details — Proposed" — the raw proposed technical value.
 * Always from `proposed_value`. Shown only when it differs from the
 * "What We Recommend" text (i.e. it's raw HTML/JSON/schema, not a readable summary).
 * Hidden if empty or if it's the same text shown in "What We Recommend".
 */
export function getTechnicalProposed(fields: ChangeFields, recommendText: string): string | null {
  const val = fields.proposed_value?.trim();
  if (!val) return null;
  // Don't show duplicate content — if proposed_value was already used as the readable recommendation
  if (val === recommendText) return null;
  // Don't show short values that don't need a technical breakdown
  if (val.length < 10) return null;
  return val;
}

/**
 * Whether to show the "Technical Details" collapsible section at all.
 */
export function hasTechnicalDetails(fields: ChangeFields, recommendText: string): boolean {
  return getTechnicalCurrent(fields) !== null || getTechnicalProposed(fields, recommendText) !== null;
}

/**
 * "View the Draft" — Google Doc link for content changes.
 * Returns the URL if doc_url exists, null otherwise.
 */
export function getDocUrl(fields: ChangeFields): string | null {
  return fields.doc_url?.trim() || null;
}

// ─── Internal Helpers ──────────────────────────────────────────

const GENERIC_DESCRIPTIONS: Record<string, string> = {
  "Metadata": "We'll update the page title and description that appear in Google search results to better match what people are searching for.",
  "Heading": "We'll improve the headings on this page to make them clearer for both search engines and visitors.",
  "Schema": "We'll add structured data to this page so Google can display rich results (like FAQ dropdowns or star ratings) in search.",
  "Content": "We'll update the content on this page to better answer the questions your potential customers are searching for.",
  "FAQ": "We'll add a Frequently Asked Questions section to this page, which can appear directly in Google search results.",
  "Redirect": "We'll fix a broken or outdated link so visitors and search engines reach the right page.",
  "Internal Link": "We'll improve the links between your pages to help search engines discover and rank your important content.",
  "Canonical": "We'll fix a technical signal that's causing search engines to see duplicate versions of this page.",
  "GEO": "We'll optimize this page so your brand appears when people use AI assistants like ChatGPT or Perplexity to research solutions.",
  "Alt Text": "We'll add descriptive text to images on this page, improving accessibility and helping search engines understand your visuals.",
  "Removal": "We'll remove outdated content that may be hurting your search rankings.",
};

function getGenericDescription(type: string): string {
  return GENERIC_DESCRIPTIONS[type] || "We'll make an optimization to this page to improve its search visibility.";
}

const AWARENESS_DESCRIPTIONS: Record<string, string> = {
  "Metadata": "We've identified that this page's metadata could be stronger. We'll prepare an optimized title and description for you to review.",
  "Heading": "We've flagged a heading issue on this page. We'll prepare a recommended fix for you to review.",
  "Schema": "We've identified a structured data opportunity on this page. We'll prepare the implementation for you to review.",
  "Content": "We've flagged content on this page that could be improved. We'll prepare recommendations for you to review.",
  "FAQ": "We've identified an opportunity to add FAQ content to this page. We'll prepare a draft for you to review.",
  "Redirect": "We've flagged a URL issue that needs attention. We'll prepare a recommended fix for you to review.",
  "Internal Link": "We've flagged an internal linking issue on this page. We'll prepare a fix for you to review.",
  "Canonical": "We've flagged a duplicate page signal that needs attention. We'll prepare a recommended fix for you to review.",
  "GEO": "We've identified an AI search visibility opportunity on this page. We'll prepare recommendations for you to review.",
  "Alt Text": "We've flagged images on this page that need descriptive text. We'll prepare alt text for you to review.",
  "Removal": "We've flagged content that may be hurting your search rankings. We'll prepare a recommendation for you to review.",
};

function getAwarenessDescription(type: string): string {
  return AWARENESS_DESCRIPTIONS[type] || "We've identified an issue on this page and will prepare a recommendation for you to review.";
}
