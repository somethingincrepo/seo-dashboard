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
  "Technical": "Fix technical SEO issue",
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
  "Technical": "Fix technical issue",
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

/**
 * For metadata changes, detect whether we're changing title, description, or both
 * from the raw current/proposed values.
 */
/**
 * Determine what's being changed by looking at the PROPOSED value.
 * If proposed mentions both title and description, it's a full listing update.
 * If only title or only description, say that specifically.
 */
export function getMetadataAction(currentValue?: string, proposedValue?: string): string {
  const proposed = proposedValue || "";
  const proposedHasTitle = /title\s*(?:tag)?\s*[:=]/i.test(proposed);
  const proposedHasDesc = /(?:meta\s*)?desc(?:ription)?\s*[:=]/i.test(proposed);
  if (proposedHasTitle && proposedHasDesc) return "Update search listing";
  if (proposedHasTitle) return "Update page title";
  if (proposedHasDesc) return "Update meta description";
  // Fallback: check current to infer context
  const current = currentValue || "";
  const currentHasTitle = /title\s*(?:tag)?\s*[:=]/i.test(current);
  const currentHasDesc = /(?:meta\s*)?desc(?:ription)?\s*[:=]/i.test(current);
  if (currentHasTitle && !currentHasDesc) return "Update page title";
  if (currentHasDesc && !currentHasTitle) return "Update meta description";
  return "Update search listing";
}

export function getListItemTitle(
  type: string,
  pageUrl: string,
  truncateAt?: number,
  changeTitle?: string,
  /** If true, return short title with readable page name instead of full path */
  shortTitle?: boolean,
  /** Pass ChangeFields for metadata-aware titles */
  fields?: { current_value?: string; proposed_value?: string }
): string {
  if (changeTitle?.trim()) return changeTitle.trim();
  let action = ACTION_VERBS[type] || `Update ${type.toLowerCase()}`;
  // For metadata, detect title vs description vs both
  if (type === "Metadata" && fields) {
    action = getMetadataAction(fields.current_value, fields.proposed_value);
  }
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
    "Technical": "No visual change",
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

// Tier 1 explanation for clients

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
  // llms.txt and robots.txt proposed values are full file contents, not instructions
  if (value.trim().startsWith('#') && (value.includes('llms.txt') || value.includes('User-agent'))) return false;
  if (value.trim().startsWith('User-agent:')) return false;
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
  const type = fields.type || fields.change_type;

  // 2. For metadata: generate a specific description based on what's changing
  if (type === "Metadata") {
    return getMetadataRecommendation(fields.current_value, fields.proposed_value);
  }
  // 2b. For GEO/Technical: detect llms.txt and robots.txt findings
  if (type === "GEO" || type === "Technical") {
    const pageUrl = (fields as unknown as Record<string, string>).page_url || "";
    const currentVal = fields.current_value || "";
    if (pageUrl.includes("llms.txt") || currentVal.includes("llms.txt")) {
      return getLlmsTxtRecommendation(currentVal);
    }
    if (pageUrl.includes("robots.txt") || currentVal.includes("robots.txt")) {
      return getRobotsTxtRecommendation(currentVal, fields.proposed_value);
    }
  }
  // 3. For content: check if the plain_english is a generic template and override
  if (type === "Content" && isGenericPlainEnglish(fields.plain_english_explanation)) {
    return getContentRecommendation(fields);
  }
  // 4. Good: proposed_value if it looks human-readable and is a real recommendation (not a flag)
  if (fields.proposed_value?.trim()) {
    const val = fields.proposed_value.trim();
    if (!val.startsWith("<") && !val.startsWith("{") && val.length > 20 && !isAwarenessFlag(val)) {
      return val;
    }
  }
  // 5. Fallback: if proposed_value is a flag/awareness item, say so honestly
  if (fields.proposed_value?.trim() && isAwarenessFlag(fields.proposed_value)) {
    return getAwarenessDescription(type);
  }
  // 6. Generic fallback
  return getGenericDescription(type);
}

const GENERIC_PLAIN_ENGLISH_PATTERNS = [
  "to improve how it appears in search results",
  "to improve its relevance and search performance",
  "that tells people what the page is about and encourages",
  "to help it rank better and attract more clicks",
  "so Google can show rich details",
  "so Google can display your frequently asked questions",
  "technical configuration so search engines can find",
  "so your brand appears when people use AI assistants",
];

function isGenericPlainEnglish(text?: string): boolean {
  if (!text?.trim()) return true;
  const lower = text.toLowerCase();
  return GENERIC_PLAIN_ENGLISH_PATTERNS.some(p => lower.includes(p));
}

/**
 * Generate a meaningful content recommendation from the proposed_value.
 * The audit agent writes detailed plans in proposed_value even though
 * the plain_english_explanation is generic.
 */
function getContentRecommendation(fields: ChangeFields): string {
  const proposed = fields.proposed_value?.trim() || "";
  const lower = proposed.toLowerCase();

  // Detect if this is actually a redirect, not content
  if (lower.includes("301 redirect") || lower.includes("redirect")) {
    const pagePath = extractPathForLabel(fields.page_url);
    return `We'll set up a redirect so visitors and search engines trying to reach ${pagePath} land on the correct, active page instead of hitting an error.`;
  }
  // Detect URL removal / noindex
  if (lower.includes("url removal") || lower.includes("noindex") || lower.includes("disallow")) {
    return "We'll remove low-value pages from Google's index that aren't serving your business — this focuses search engine attention on the pages that actually drive traffic.";
  }
  // Detect content consolidation
  if (lower.includes("consolidat")) {
    return "We've found pages with overlapping content that are competing against each other in search results. We'll merge them into one stronger page that has a better chance of ranking.";
  }
  // Detect content expansion
  if (lower.includes("expand") || lower.includes("rewrite") || /\d+-\d+\s*words/.test(lower)) {
    const pagePath = extractPathForLabel(fields.page_url);
    return `The content on ${pagePath} needs to be more thorough to compete in search. We'll expand it with the specific details, services, and answers that searchers are looking for.`;
  }
  // Detect FAQ addition
  if (lower.includes("faq")) {
    const pagePath = extractPathForLabel(fields.page_url);
    return `We'll add a FAQ section to ${pagePath} that answers the questions your potential customers are actually searching for — this also enables FAQ-rich results in Google.`;
  }
  // Fallback: show a summarized version of the proposed value
  if (proposed.length > 30) {
    // Truncate to first sentence or 200 chars
    const firstSentence = proposed.split(/\.\s/)[0];
    if (firstSentence.length < 200) {
      return firstSentence + ".";
    }
    return proposed.slice(0, 197) + "...";
  }
  return getGenericDescription("Content");
}

function extractPathForLabel(url?: string): string {
  if (!url) return "this page";
  try {
    const pathname = new URL(url).pathname;
    return pathname === "/" ? "your homepage" : pathname;
  } catch {
    return "this page";
  }
}

function getMetadataRecommendation(currentValue?: string, proposedValue?: string): string {
  const action = getMetadataAction(currentValue, proposedValue);
  switch (action) {
    case "Update page title":
      return "We'll update this page's title tag — that's the clickable headline that shows up in Google search results. A clearer, more relevant title helps the right people find and click on your page.";
    case "Update meta description":
      return "We'll update this page's meta description — that's the short summary that appears below your title in Google search results. A compelling description can significantly increase how often people click through to your site.";
    default:
      return "We'll update both the title and description for this page in Google search results. These control what people see when your page shows up in search — making them clearer and more relevant helps drive more clicks.";
  }
}

/**
 * "Why It Matters" — business value explanation.
 * Priority: business_impact_explanation > reasoning (filtered) > category fallback
 */
// These are the generic templates the audit agent copy-pasted across dozens of records.
// If we detect one, ignore it and generate something specific instead.
const GENERIC_WHY_PATTERNS = [
  "directly answers customer questions",
  "foundation of search visibility",
  "more people clicking on your listing when it appears",
  "single biggest lever for increasing organic traffic",
  "structured data makes your listings stand out",
  "20-30% higher click-through rates",
  "without proper crawlability",
];

function isGenericWhyItMatters(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_WHY_PATTERNS.some(p => lower.includes(p));
}

export function getWhyItMatters(fields: ChangeFields): string {
  const type = fields.type || fields.change_type;

  // 1. Best: dedicated business impact field — but only if it's not a generic template
  if (fields.business_impact_explanation?.trim() && !isGenericWhyItMatters(fields.business_impact_explanation)) {
    return fields.business_impact_explanation;
  }

  // 2. Good: reasoning if it looks client-appropriate (not agent jargon)
  if (fields.reasoning?.trim()) {
    const r = fields.reasoning.trim();
    if (!r.startsWith("[") && !r.startsWith("SOP") && r.length > 15 && !isGenericWhyItMatters(r)) {
      return r;
    }
  }

  // 3. Generate specific "Why It Matters" based on change type
  return getSpecificWhyItMatters(type, fields);
}

function getSpecificWhyItMatters(type: string, fields: ChangeFields): string {
  const proposed = fields.proposed_value?.trim() || "";
  const current = fields.current_value?.trim() || "";

  switch (type) {
    case "Metadata": {
      const action = getMetadataAction(current, proposed);
      if (action === "Update page title") {
        return "Your page title is the first thing people see in Google search results. A clearer, more specific title helps searchers understand what your page offers — which directly translates to more clicks.";
      }
      if (action === "Update meta description") {
        return "The meta description is your page's sales pitch in search results. When it clearly describes what visitors will find, click-through rates improve — meaning more traffic from the same rankings.";
      }
      return "The title and description control how your page appears in every Google search result. When they're clear and relevant, more people click — that's more traffic without needing higher rankings.";
    }
    case "Heading":
      return "Page headings tell both visitors and search engines what each section is about. Fixing heading structure helps Google understand your content and makes the page easier for visitors to scan.";
    case "Schema":
      return "Structured data helps Google display enhanced search results for your page — like FAQ dropdowns, ratings, or service details. These rich results stand out and typically earn more clicks.";
    case "Redirect":
      return "Broken or outdated URLs mean lost visitors and wasted search authority. Fixing redirects ensures people (and search engines) reach the right page instead of hitting dead ends.";
    case "Content":
      return "Comprehensive, well-organized content is what earns higher rankings. When your pages thoroughly cover what people are searching for, Google treats them as more authoritative.";
    case "FAQ":
      return "FAQ sections serve double duty — they answer real customer questions on your page and can appear as expandable results directly in Google search, capturing more attention.";
    case "GEO":
      return "AI search engines like ChatGPT and Perplexity are becoming how people research services. Optimizing for AI visibility ensures your brand shows up when potential customers ask these tools for recommendations.";
    case "Technical":
      return "Technical SEO issues can quietly hold back your entire site. Fixing these ensures search engines can properly crawl, index, and rank all your important pages.";
    case "Alt Text":
      return "Image descriptions improve accessibility for screen readers and help search engines understand your visual content — both contribute to better overall SEO performance.";
    case "Canonical":
      return "Duplicate page signals confuse search engines about which version of a page to rank. Fixing canonicals consolidates your search authority onto the right URLs.";
    case "Internal Link":
      return "Internal links help search engines discover your important pages and understand how your content is organized. Better linking spreads ranking authority to the pages that matter most.";
    case "Technical":
      return "Technical SEO issues can quietly hold back your entire site. Fixing these ensures search engines can properly crawl, index, and rank all your important pages.";
    default:
      return "";
  }
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
  "Technical": "We'll fix a technical issue that's preventing search engines from properly crawling or indexing this part of your site.",
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
  "Technical": "We've flagged a technical issue that may be affecting how search engines access your site. We'll prepare a recommended fix for you to review.",
};

function getAwarenessDescription(type: string): string {
  return AWARENESS_DESCRIPTIONS[type] || "We've identified an issue on this page and will prepare a recommendation for you to review.";
}

// ─── llms.txt & robots.txt Helpers ─────────────────────────────

function getLlmsTxtRecommendation(currentValue: string): string {
  if (currentValue.includes("404") || currentValue.includes("does not exist")) {
    return "Your site doesn't have an llms.txt file — this is a simple text file that helps AI assistants like ChatGPT, Perplexity, and Google's AI Overviews understand what your business does and which pages are most important. We'll create one using your actual services and key pages so AI tools can recommend you more accurately.";
  }
  return "Your llms.txt file exists but needs updating — it's missing key services or pages that AI assistants should know about. We'll update it to accurately reflect your full business so AI tools have the best possible picture of what you offer.";
}

function getRobotsTxtRecommendation(currentValue: string, proposedValue?: string): string {
  if (currentValue.includes("404") || currentValue.includes("does not exist")) {
    return "Your site is missing a robots.txt file — this tells search engines which parts of your site to crawl and where to find your sitemap. Without it, search engines have to guess. We'll create one with the right rules for your site.";
  }
  const proposed = proposedValue?.toLowerCase() || "";
  if (proposed.includes("sitemap")) {
    return "Your robots.txt file doesn't include a link to your sitemap. Adding a Sitemap directive helps Google discover all your pages faster — it's like handing Google a map instead of making it find everything on its own.";
  }
  if (currentValue.toLowerCase().includes("disallow") && proposed.includes("allow")) {
    return "Your robots.txt file is currently blocking search engines from crawling some of your important pages. We'll update the rules so Google can access and index all the pages that should be appearing in search results.";
  }
  return "Your robots.txt file needs adjustments to make sure search engines are crawling your site correctly. We'll update the rules to match your current site structure.";
}
