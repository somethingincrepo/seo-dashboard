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
