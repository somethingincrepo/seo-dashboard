import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { normalizeUrl, sameHost } from "./url.js";

export interface ExtractedPage {
  url: string;
  status_code: number;
  redirect_target: string | null;
  redirect_chain: { url: string; status: number }[];
  response_time_ms: number;
  rendered_html_size: number;
  is_https: boolean;
  mixed_content_count: number;

  title: string | null;
  title_length: number | null;
  meta_description: string | null;
  meta_description_length: number | null;

  h1_text: string | null;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  headings: { level: number; text: string }[];
  has_skipped_heading_level: boolean;

  canonical_url: string | null;
  canonical_self_referencing: boolean;
  is_indexable: boolean;
  noindex: boolean;
  nofollow: boolean;

  schema_types: string[];
  schema_blocks: unknown[];
  schema_invalid_count: number;

  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string | null;
  twitter_card: string | null;

  hreflang_tags: { lang: string; href: string }[];
  hreflang_invalid: boolean;

  internal_links_out: number;
  external_links_out: number;
  generic_anchor_count: number;
  unsafe_blank_target_count: number;
  internal_link_targets: string[];
  external_link_targets: string[];

  word_count: number;
  text_to_html_ratio: number;
  content_hash: string;

  images_count: number;
  alt_text_missing_count: number;
  alt_text_empty_count: number;
  alt_text_too_long_count: number;
  alt_text_filename_count: number;
  alt_text_duplicate_count: number;

  placeholder_text_found: string[];
  unsubstituted_vars: string[];
  has_faq_format: boolean;
  has_numbered_steps: boolean;
  has_table_without_header: boolean;
  has_single_item_list: boolean;
  date_published: string | null;
  date_modified: string | null;
  has_author: boolean;
  has_table_of_contents: boolean;

  page_type: "home" | "article" | "product" | "category" | "other";
}

const GENERIC_ANCHORS = new Set([
  "click here", "click", "read more", "learn more", "more", "more info",
  "here", "this", "this link", "link", "details",
]);
const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i, /\btodo\b/i, /\bfixme\b/i, /coming soon/i, /under construction/i,
];
const UNSUB_VAR_PATTERNS = [
  /\{\{[^}]+\}\}/g, /\[\[[^\]]+\]\]/g, /%%[a-zA-Z_]+%%/g, /\{[a-zA-Z_]+\}/g,
];
const FILENAME_ALT_RE = /^[\w-]+\.(jpe?g|png|gif|webp|svg|avif)$/i;

export interface ExtractionInput {
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: { url: string; status: number }[];
  responseTimeMs: number;
  html: string;
  visibleText: string;
  pageOrigin: string;
}

export function extract(input: ExtractionInput): ExtractedPage {
  const $ = cheerio.load(input.html);
  const url = input.finalUrl;
  const isHttps = url.startsWith("https://");

  // Robots / indexability
  const robotsMeta = ($('meta[name="robots"]').attr("content") || "").toLowerCase();
  const noindex = /(^|,|\s)noindex/.test(robotsMeta);
  const nofollow = /(^|,|\s)nofollow/.test(robotsMeta);
  const isIndexable = !noindex;

  // Title
  const title = $("title").first().text().trim() || null;
  const titleLength = title ? title.length : null;

  // Meta description
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const metaDescriptionLength = metaDescription ? metaDescription.length : null;

  // Headings
  const headings: { level: number; text: string }[] = [];
  for (let lvl = 1; lvl <= 6; lvl++) {
    $(`h${lvl}`).each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.push({ level: lvl, text });
    });
  }
  const h1Texts = headings.filter((h) => h.level === 1).map((h) => h.text);
  const h1Count = h1Texts.length;
  const h2Count = headings.filter((h) => h.level === 2).length;
  const h3Count = headings.filter((h) => h.level === 3).length;
  let hasSkippedHeading = false;
  let prev = 0;
  for (const h of headings) {
    if (prev !== 0 && h.level > prev + 1) hasSkippedHeading = true;
    prev = h.level;
  }

  // Canonical
  const rawCanonical = $('link[rel="canonical"]').attr("href");
  let canonicalUrl: string | null = null;
  if (rawCanonical) {
    try { canonicalUrl = new URL(rawCanonical, url).toString(); } catch { canonicalUrl = null; }
  }
  const canonicalSelfReferencing = canonicalUrl ? normalizeUrl(canonicalUrl) === normalizeUrl(url) : false;

  // Schema
  const schemaBlocks: unknown[] = [];
  const schemaTypes: string[] = [];
  let schemaInvalid = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        schemaBlocks.push(item);
        const t = (item && typeof item === "object" && (item as Record<string, unknown>)["@type"]) as unknown;
        if (typeof t === "string") schemaTypes.push(t);
        else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") schemaTypes.push(x);
      }
    } catch {
      schemaInvalid += 1;
    }
  });

  // OG / Twitter
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
  const ogImageRaw = $('meta[property="og:image"]').attr("content")?.trim() || null;
  const ogImage = ogImageRaw ? safeAbs(ogImageRaw, url) : null;
  const ogType = $('meta[property="og:type"]').attr("content")?.trim() || null;
  const twitterCard = $('meta[name="twitter:card"]').attr("content")?.trim() || null;

  // Hreflang
  const hreflangTags: { lang: string; href: string }[] = [];
  let hreflangInvalid = false;
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr("hreflang") || "";
    const href = $(el).attr("href") || "";
    if (lang && href) hreflangTags.push({ lang, href: safeAbs(href, url) ?? href });
    if (lang && !/^([a-z]{2,3})(-[a-zA-Z]+)?$/i.test(lang) && lang !== "x-default") hreflangInvalid = true;
  });

  // Links
  let internalOut = 0;
  let externalOut = 0;
  let genericAnchor = 0;
  let unsafeBlank = 0;
  const internalTargets = new Set<string>();
  const externalTargets = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const abs = safeAbs(href, url);
    if (!abs) return;
    const anchor = $(el).text().trim().toLowerCase();
    if (anchor && GENERIC_ANCHORS.has(anchor)) genericAnchor += 1;
    if ($(el).attr("target") === "_blank") {
      const rel = ($(el).attr("rel") || "").toLowerCase();
      if (!rel.includes("noopener")) unsafeBlank += 1;
    }
    if (sameHost(abs, input.pageOrigin)) {
      internalOut += 1;
      internalTargets.add(normalizeUrl(abs));
    } else {
      externalOut += 1;
      externalTargets.add(abs);
    }
  });

  // Mixed content
  let mixedContent = 0;
  if (isHttps) {
    $("img[src], script[src], link[href], iframe[src], audio[src], video[src], source[src]").each((_, el) => {
      const attr = el.tagName === "link" ? "href" : "src";
      const v = $(el).attr(attr);
      if (v && v.startsWith("http://")) mixedContent += 1;
    });
  }

  // Content
  const visibleText = input.visibleText.replace(/\s+/g, " ").trim();
  const wordCount = visibleText ? visibleText.split(/\s+/).length : 0;
  const renderedHtmlSize = Buffer.byteLength(input.html, "utf8");
  const textToHtmlRatio = renderedHtmlSize > 0 ? +(visibleText.length / renderedHtmlSize).toFixed(4) : 0;
  const contentHash = createHash("sha1").update(visibleText.toLowerCase()).digest("hex");

  // Images
  let imagesCount = 0;
  let altMissing = 0;
  let altEmpty = 0;
  let altTooLong = 0;
  let altFilename = 0;
  const altTexts: string[] = [];
  $("img").each((_, el) => {
    imagesCount += 1;
    const alt = $(el).attr("alt");
    if (alt === undefined) { altMissing += 1; return; }
    if (alt.trim() === "") { altEmpty += 1; return; }
    altTexts.push(alt.trim());
    if (alt.length > 125) altTooLong += 1;
    if (FILENAME_ALT_RE.test(alt.trim())) altFilename += 1;
  });
  const altCounts = new Map<string, number>();
  for (const a of altTexts) altCounts.set(a.toLowerCase(), (altCounts.get(a.toLowerCase()) ?? 0) + 1);
  let altDuplicate = 0;
  for (const v of altCounts.values()) if (v > 1) altDuplicate += v;

  // Placeholders
  const placeholders: string[] = [];
  for (const re of PLACEHOLDER_PATTERNS) {
    const m = visibleText.match(re);
    if (m) placeholders.push(m[0].toLowerCase());
  }
  const unsubVars = new Set<string>();
  for (const re of UNSUB_VAR_PATTERNS) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, "g");
    while ((m = r.exec(visibleText)) !== null) {
      // Skip {N} numeric refs
      if (/^\{\d+\}$/.test(m[0])) continue;
      unsubVars.add(m[0]);
      if (unsubVars.size >= 20) break;
    }
  }

  // Q&A and steps detection
  const hasFaq = headings.some((h) => /\?$/.test(h.text)) && headings.filter((h) => /\?$/.test(h.text)).length >= 2;
  const numberedSteps = headings.filter((h) => /^(step\s+)?\d+[\.\):]/i.test(h.text.trim())).length;
  const hasNumbered = numberedSteps >= 3;

  // Tables / lists / TOC
  let hasTableNoHeader = false;
  $("table").each((_, el) => {
    if ($(el).find("th").length === 0) hasTableNoHeader = true;
  });
  let singleItemList = false;
  $("ul, ol").each((_, el) => {
    if ($(el).children("li").length === 1) singleItemList = true;
  });
  const hasToc = $("nav.toc, [class*=table-of-contents], [id=toc], [class*=Toc]").length > 0;

  // Author / dates from schema
  let datePublished: string | null = null;
  let dateModified: string | null = null;
  let hasAuthor = false;
  for (const b of schemaBlocks) {
    if (!b || typeof b !== "object") continue;
    const obj = b as Record<string, unknown>;
    if (typeof obj.datePublished === "string") datePublished = obj.datePublished;
    if (typeof obj.dateModified === "string") dateModified = obj.dateModified;
    if (obj.author) hasAuthor = true;
  }

  // Page type heuristic
  const pageType = classifyPageType(url, $, schemaTypes);

  return {
    url,
    status_code: input.statusCode,
    redirect_target: input.redirectChain.length > 0 ? input.finalUrl : null,
    redirect_chain: input.redirectChain,
    response_time_ms: input.responseTimeMs,
    rendered_html_size: renderedHtmlSize,
    is_https: isHttps,
    mixed_content_count: mixedContent,
    title,
    title_length: titleLength,
    meta_description: metaDescription,
    meta_description_length: metaDescriptionLength,
    h1_text: h1Texts[0] ?? null,
    h1_count: h1Count,
    h2_count: h2Count,
    h3_count: h3Count,
    headings,
    has_skipped_heading_level: hasSkippedHeading,
    canonical_url: canonicalUrl,
    canonical_self_referencing: canonicalSelfReferencing,
    is_indexable: isIndexable,
    noindex,
    nofollow,
    schema_types: Array.from(new Set(schemaTypes)),
    schema_blocks: schemaBlocks,
    schema_invalid_count: schemaInvalid,
    og_title: ogTitle,
    og_description: ogDescription,
    og_image: ogImage,
    og_type: ogType,
    twitter_card: twitterCard,
    hreflang_tags: hreflangTags,
    hreflang_invalid: hreflangInvalid,
    internal_links_out: internalOut,
    external_links_out: externalOut,
    generic_anchor_count: genericAnchor,
    unsafe_blank_target_count: unsafeBlank,
    internal_link_targets: Array.from(internalTargets),
    external_link_targets: Array.from(externalTargets),
    word_count: wordCount,
    text_to_html_ratio: textToHtmlRatio,
    content_hash: contentHash,
    images_count: imagesCount,
    alt_text_missing_count: altMissing,
    alt_text_empty_count: altEmpty,
    alt_text_too_long_count: altTooLong,
    alt_text_filename_count: altFilename,
    alt_text_duplicate_count: altDuplicate,
    placeholder_text_found: placeholders,
    unsubstituted_vars: Array.from(unsubVars),
    has_faq_format: hasFaq,
    has_numbered_steps: hasNumbered,
    has_table_without_header: hasTableNoHeader,
    has_single_item_list: singleItemList,
    date_published: datePublished,
    date_modified: dateModified,
    has_author: hasAuthor,
    has_table_of_contents: hasToc,
    page_type: pageType,
  };
}

function safeAbs(href: string, base: string): string | null {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function classifyPageType(
  url: string,
  $: cheerio.CheerioAPI,
  schemaTypes: string[],
): "home" | "article" | "product" | "category" | "other" {
  const u = new URL(url);
  if (u.pathname === "/" || u.pathname === "") return "home";
  if (schemaTypes.includes("Product")) return "product";
  if (schemaTypes.some((t) => t === "Article" || t === "BlogPosting" || t === "NewsArticle")) return "article";
  if (/\/(blog|article|post|news)\//i.test(u.pathname)) return "article";
  if (/\/(product|item|shop)\//i.test(u.pathname)) return "product";
  if ($("article").length > 0 && $("article p").length >= 3) return "article";
  if (/\/(category|categories|tag|tags|collection)\//i.test(u.pathname)) return "category";
  return "other";
}
