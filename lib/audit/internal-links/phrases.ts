/**
 * Build ranked anchor-text candidate phrases for a target page.
 *
 * The output is the list of literal phrases we will look for on candidate
 * source pages — the deterministic equivalent of "what should the link say
 * about this destination?". Phrases come exclusively from the target page's
 * own metadata (h1, cleaned title, h2/h3 headings) so the anchor always
 * describes the destination accurately, and from the client's keyword groups
 * when they overlap with the target page's topic.
 *
 * Each phrase carries a `priority` (1 = best). Lower number ranks higher in
 * the deterministic scorer.
 */

import type { Page } from "../rules/types";

export interface Phrase {
  /** Lowercased, trimmed phrase to match against source page text. */
  text: string;
  /** Source of the phrase, used in the rationale. */
  source: "h1" | "title" | "h2" | "h3" | "keyword";
  /** Priority (1 = highest). H1 = 1, title = 2, h2 = 3, h3 = 4, keyword = 5. */
  priority: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "as", "if", "than", "then",
  "so", "into", "about", "your", "our", "you", "we", "they", "their",
]);

const BRAND_SEPARATORS = ["|", "—", "–", " - ", "::", "•"];

const MIN_PHRASE_CHARS = 10;
const MAX_PHRASE_CHARS = 80;
const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_WORDS = 7;

/** Normalize a phrase: lowercase, collapse whitespace, strip surrounding punctuation. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "")
    .trim();
}

function wordCount(s: string): number {
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

function isAllStopwords(s: string): boolean {
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => STOPWORDS.has(w.replace(/[^a-z0-9]/g, "")));
}

function passesQualityGate(phrase: string): boolean {
  if (phrase.length < MIN_PHRASE_CHARS || phrase.length > MAX_PHRASE_CHARS) return false;
  const wc = wordCount(phrase);
  if (wc < MIN_PHRASE_WORDS || wc > MAX_PHRASE_WORDS) return false;
  if (isAllStopwords(phrase)) return false;
  // Generic anchors we never want to propose.
  const banned = new Set([
    "click here", "read more", "learn more", "find out more", "more info",
    "more information", "this page", "this article", "see more", "here",
  ]);
  if (banned.has(phrase)) return false;
  return true;
}

/** Strip the brand/site name suffix from a title, returning the lead phrase. */
export function cleanTitle(title: string | null, brand: string | null): string {
  if (!title) return "";
  let t = title.trim();
  for (const sep of BRAND_SEPARATORS) {
    const idx = t.lastIndexOf(sep);
    if (idx !== -1 && idx > t.length / 3) {
      // Only strip when the suffix is short (< 40 chars) — looks like a brand
      // suffix, not a real subtitle.
      const suffix = t.slice(idx + sep.length).trim();
      if (suffix.length > 0 && suffix.length <= 40) {
        t = t.slice(0, idx).trim();
        break;
      }
    }
  }
  if (brand) {
    const b = brand.toLowerCase();
    if (t.toLowerCase().endsWith(b)) {
      t = t.slice(0, t.length - brand.length).replace(/[\s\-—–|:•]+$/g, "").trim();
    }
  }
  return t;
}

export interface PhraseInputs {
  /** The target page we want inbound links to. */
  target: Page;
  /** Optional brand/site name, used to strip title suffixes. */
  brand?: string | null;
  /** Optional client keyword groups (subkeyword strings). */
  keywords?: string[];
}

/**
 * Produce a deterministically ordered list of unique phrase candidates for the
 * target page. Order: priority asc, then phrase text asc (for stable ties).
 */
export function buildPhraseCandidates(inputs: PhraseInputs): Phrase[] {
  const seen = new Set<string>();
  const out: Phrase[] = [];

  function push(text: string, source: Phrase["source"], priority: number) {
    const norm = normalizePhrase(text);
    if (!norm || !passesQualityGate(norm)) return;
    if (seen.has(norm)) return;
    seen.add(norm);
    out.push({ text: norm, source, priority });
  }

  const { target, brand = null, keywords = [] } = inputs;

  // 1. H1 — highest priority
  if (target.h1_text) push(target.h1_text, "h1", 1);

  // 2. Title (cleaned of brand suffix)
  const cleaned = cleanTitle(target.title, brand);
  if (cleaned) push(cleaned, "title", 2);

  // 3. H2 / H3 headings
  if (target.headings) {
    for (const h of target.headings) {
      if (h.level === 2) push(h.text, "h2", 3);
    }
    for (const h of target.headings) {
      if (h.level === 3) push(h.text, "h3", 4);
    }
  }

  // 4. Keyword group entries — only those that share a content word with the
  //    target's title/h1, so we don't pull unrelated keywords into anchors.
  const targetBag = topicWords(`${target.title ?? ""} ${target.h1_text ?? ""}`);
  for (const kw of keywords) {
    const kwWords = topicWords(kw);
    if (kwWords.size === 0) continue;
    let overlap = 0;
    for (const w of kwWords) if (targetBag.has(w)) overlap += 1;
    if (overlap === 0) continue;
    push(kw, "keyword", 5);
  }

  out.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.text.localeCompare(b.text);
  });
  return out;
}

/** Lowercase content words (no stopwords, no short tokens). */
function topicWords(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of s.toLowerCase().split(/\W+/)) {
    if (raw.length < 4) continue;
    if (STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}
