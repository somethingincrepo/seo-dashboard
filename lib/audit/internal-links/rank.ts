/**
 * Deterministic ranker for internal-link match candidates.
 *
 * A "candidate" is one (source page, target page, source block, match
 * position, phrase) tuple. The ranker:
 *   1. Filters out structurally bad candidates (overlinked sources, banned
 *      page-type pairings).
 *   2. Computes a tuple score per candidate.
 *   3. Sorts by score with fully ordered tiebreaks.
 *   4. Picks the top N, deduplicating so we never propose the same target
 *      twice for one issue, or two anchors in the same source paragraph.
 *
 * No randomness, no LLM, no time-of-day inputs. Same inputs → same picks.
 */

import type { Page } from "../rules/types";
import type { Block } from "./extract";
import type { Match } from "./scan";

export interface Candidate {
  source: Page;
  target: Page;
  block: Block;
  match: Match;
}

/** Heuristic: pages with many outbound links are bad places to add another. */
const SOURCE_DILUTION_CAP = 30;

/** Score components — kept on the proposal so the user can see the rationale. */
export interface ScoreComponents {
  phrase_priority: number;
  page_type_fit: number;
  authority: number;
  dilution_penalty: number;
  position: number;
}

/** Lower is better for `phrase_priority` and `page_type_fit`; higher is better for `authority`. */
function pageTypeFit(source: Page["page_type"], target: Page["page_type"]): number {
  // 1 = best, 5 = neutral, higher = worse. Banned pairings (returns 999) get
  // dropped by the filter.
  if (!source || !target) return 5;
  // Articles → service/product is the high-converting pattern.
  if (source === "article" && (target === "category" || target === "product")) return 1;
  if (source === "article" && target === "article") return 2;
  // Service / category pages support each other.
  if (source === "category" && target === "category") return 1;
  if (source === "category" && target === "article") return 2;
  if (source === "category" && target === "product") return 2;
  // Product cross-sells.
  if (source === "product" && target === "product") return 2;
  if (source === "product" && target === "category") return 1;
  if (source === "product" && target === "article") return 3;
  // Home page → anywhere is fine but rarely the best signal.
  if (source === "home") return 4;
  return 5;
}

function isPairAllowed(c: Candidate): boolean {
  if (c.source.id === c.target.id) return false;
  if (c.source.status_code !== 200) return false;
  if (c.source.is_indexable === false) return false;
  if ((c.source.word_count ?? 0) < 100) return false;
  if ((c.source.internal_links_out ?? 0) >= SOURCE_DILUTION_CAP) return false;
  return true;
}

export function scoreCandidate(c: Candidate): ScoreComponents {
  return {
    phrase_priority: c.match.phrase.priority,
    page_type_fit: pageTypeFit(c.source.page_type, c.target.page_type),
    authority: c.source.internal_links_in ?? 0,
    dilution_penalty: c.source.internal_links_out ?? 0,
    position: c.match.block_index * 10000 + c.match.text_start,
  };
}

/**
 * Compare two candidates. Returns negative if `a` should come first (better).
 * Order: priority asc, type-fit asc, authority desc, dilution asc, position
 * asc, source URL asc, phrase asc. The final two tiebreaks make the order
 * stable regardless of input list order.
 */
export function compareCandidates(a: Candidate, b: Candidate): number {
  const sa = scoreCandidate(a);
  const sb = scoreCandidate(b);
  if (sa.phrase_priority !== sb.phrase_priority) return sa.phrase_priority - sb.phrase_priority;
  if (sa.page_type_fit !== sb.page_type_fit) return sa.page_type_fit - sb.page_type_fit;
  if (sa.authority !== sb.authority) return sb.authority - sa.authority;
  if (sa.dilution_penalty !== sb.dilution_penalty) return sa.dilution_penalty - sb.dilution_penalty;
  if (sa.position !== sb.position) return sa.position - sb.position;
  if (a.source.url !== b.source.url) return a.source.url.localeCompare(b.source.url);
  return a.match.phrase.text.localeCompare(b.match.phrase.text);
}

export interface PickOptions {
  /** Maximum proposals to return. */
  limit: number;
  /** If true (R050), only allow nav pages or the homepage as sources. */
  require_nav_source?: boolean;
}

/**
 * Pick top-N candidates with deterministic dedup:
 *   - one proposal per distinct (source URL, target URL) pair,
 *   - one proposal per source paragraph (no two anchors in the same block),
 *   - one proposal per target URL within a single issue's set.
 */
export function pickTopCandidates(
  candidates: Candidate[],
  opts: PickOptions,
): Candidate[] {
  const filtered = candidates.filter((c) => {
    if (!isPairAllowed(c)) return false;
    if (opts.require_nav_source && !(c.source.is_nav_page === true || c.source.page_type === "home")) {
      return false;
    }
    return true;
  });
  const sorted = [...filtered].sort(compareCandidates);
  const seenPair = new Set<string>();
  const seenBlock = new Set<string>();
  const seenTarget = new Set<string>();
  const out: Candidate[] = [];
  for (const c of sorted) {
    const pairKey = `${c.source.url}::${c.target.url}`;
    const blockKey = `${c.source.url}#b${c.match.block_index}`;
    if (seenPair.has(pairKey)) continue;
    if (seenBlock.has(blockKey)) continue;
    if (seenTarget.has(c.target.url)) continue;
    seenPair.add(pairKey);
    seenBlock.add(blockKey);
    seenTarget.add(c.target.url);
    out.push(c);
    if (out.length >= opts.limit) break;
  }
  return out;
}
