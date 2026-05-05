/**
 * Deterministic text scanner.
 *
 * Given a source page's body blocks and a list of phrases (anchor candidates
 * for some target page), find every block position where the phrase appears
 * as a whole-word, case-insensitive match — but NOT inside an existing <a>.
 *
 * Output is the raw match list. Ranking lives in rank.ts so this stays a pure
 * substring-search.
 */

import type { Block } from "./extract";
import type { Phrase } from "./phrases";

export interface Match {
  block_index: number;
  /** Char offsets into block.text. */
  text_start: number;
  text_end: number;
  /** Phrase that matched. */
  phrase: Phrase;
}

/** Whole-word boundary check: the char on either side of a match must not be a word char. */
function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[\p{L}\p{N}_]/u.test(ch);
}

function overlapsAnchored(start: number, end: number, anchored: Array<[number, number]>): boolean {
  for (const [s, e] of anchored) {
    if (start < e && end > s) return true;
  }
  return false;
}

/** Find all matches of `phrase` in a single block's text. */
export function findMatchesInBlock(block: Block, phrase: Phrase): Match[] {
  const haystack = block.text.toLowerCase();
  const needle = phrase.text;
  if (needle.length === 0) return [];
  const out: Match[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    const before = idx === 0 ? undefined : block.text[idx - 1];
    const after = block.text[idx + needle.length];
    if (!isWordChar(before) && !isWordChar(after)) {
      const end = idx + needle.length;
      if (!overlapsAnchored(idx, end, block.anchored_ranges)) {
        out.push({
          block_index: block.block_index,
          text_start: idx,
          text_end: end,
          phrase,
        });
      }
    }
    from = idx + 1;
  }
  return out;
}

/**
 * Scan the full source body for all phrase matches across all blocks.
 *
 * Returns matches sorted by (block_index asc, text_start asc, phrase priority
 * asc, phrase text asc) so iteration order is deterministic.
 */
export function scanBody(blocks: Block[], phrases: Phrase[]): Match[] {
  const out: Match[] = [];
  for (const block of blocks) {
    for (const phrase of phrases) {
      out.push(...findMatchesInBlock(block, phrase));
    }
  }
  out.sort((a, b) => {
    if (a.block_index !== b.block_index) return a.block_index - b.block_index;
    if (a.text_start !== b.text_start) return a.text_start - b.text_start;
    if (a.phrase.priority !== b.phrase.priority) return a.phrase.priority - b.phrase.priority;
    return a.phrase.text.localeCompare(b.phrase.text);
  });
  return out;
}
