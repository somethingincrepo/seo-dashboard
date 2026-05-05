/**
 * Shared helpers used by multiple rules. Anything in here should be a pure
 * function of the Page row — no side effects, no I/O.
 */
import type { Page } from "./types";

const BOT_CHALLENGE_TITLES = new Set<string>([
  "client challenge",
  "just a moment...",
  "just a moment",
  "attention required! | cloudflare",
  "attention required",
  "access denied",
  "please wait...",
  "checking your browser",
  "one moment, please...",
  "one moment please",
  "verify you are human",
  "ddos-guard",
]);

/**
 * Returns true if the crawler likely received a bot-challenge / WAF block
 * instead of the real page. Symptoms: a generic challenge-style title, OR a
 * 200 response with effectively no body content. Pages flagged this way
 * should be excluded from rules that compare across pages (duplicate
 * detection, content-hash matches), since the false positives are
 * structural rather than informative.
 */
export function isBotChallengePage(page: Page): boolean {
  if (page.title) {
    const t = page.title.trim().toLowerCase();
    if (BOT_CHALLENGE_TITLES.has(t)) return true;
  }
  // Bot pages often have very short bodies + no headings even after hydration
  if (page.status_code === 200 && (page.word_count ?? 0) < 30 && (page.h1_count ?? 0) === 0) {
    return true;
  }
  return false;
}

/**
 * Pagination pages (`/blog/page/2`, `/?page=3`, etc.) naturally share the
 * title, meta description, and most of the body with their parent listing
 * page. Treating them as duplicates is a false positive — they're meant to
 * be paginated views of the same archive. Rules that fire on cross-page
 * duplication (R026, R031, R055) should skip these.
 */
const PAGINATION_RES: RegExp[] = [
  /\/page\/\d+\/?$/i,         // /blog/page/2, /blog/page/2/
  /[?&](page|paged)=\d+/i,    // /?page=3, /?paged=3
  /\/p\/\d+\/?$/i,            // /blog/p/3
];
export function isPaginationPage(page: Page): boolean {
  const url = page.url ?? "";
  return PAGINATION_RES.some((re) => re.test(url));
}
