/**
 * Deterministic internal-link generator.
 *
 * Given an audit's pages + the issues raised by R047/R048/R049/R050, fetch
 * the relevant source page HTML (deterministically extract content blocks,
 * scan for target-derived phrases, rank by tuple-score), and emit one
 * LinkProposal per accepted suggestion.
 *
 * The fetcher is injected so unit tests can supply pre-canned HTML and
 * production can use the global `fetch`. There are no other side effects
 * here — the caller is responsible for writing proposals back to Supabase.
 */

import type { Page } from "../rules/types";
import { extractBody, type Block } from "./extract";
import { buildPhraseCandidates, type Phrase } from "./phrases";
import { scanBody, type Match } from "./scan";
import { pickTopCandidates, scoreCandidate, type Candidate } from "./rank";
import type { LinkProposal } from "./types";

export interface IssueInput {
  id: string;
  rule_id: string;
  page_id: string | null;
  page_url: string | null;
}

export type Fetcher = (url: string) => Promise<{ ok: boolean; html: string }>;

export interface GenerateInput {
  issues: IssueInput[];
  pages: Page[];
  /** Optional brand/site name for title cleanup. */
  brand?: string | null;
  /** Optional client keyword groups (already flattened to subkeyword strings). */
  keywords?: string[];
  /** Page fetcher. Defaults to a built-in fetch with a 10s timeout. */
  fetcher?: Fetcher;
  /** Concurrency for HTML fetches. */
  concurrency?: number;
  /** Wall clock for `generated_at`. Override in tests for stable snapshots. */
  now?: () => Date;
}

export interface GenerateOutput {
  proposals: Array<{ issue_id: string; proposal: LinkProposal }>;
  failures: Array<{ issue_id: string; reason: string }>;
}

const RULES_LIMIT_AND_DIRECTION: Record<
  string,
  { direction: "subject_is_source" | "subject_is_target"; limit: number; require_nav_source?: boolean }
> = {
  R047: { direction: "subject_is_source", limit: 3 },
  R048: { direction: "subject_is_target", limit: 2 },
  R049: { direction: "subject_is_target", limit: 1 },
  R050: { direction: "subject_is_target", limit: 1, require_nav_source: true },
};

/**
 * Maximum share of accepted proposals that can come from R050 (only-1-inbound
 * link). R050 fires on almost every page once the obvious orphans/dead-ends
 * are cleared, so without a cap weekly runs eventually become 100% R050 churn.
 * Capping at 30% keeps the high-signal R047/R048 rules dominant.
 */
const R050_MAX_SHARE = 0.3;

export async function generateProposals(input: GenerateInput): Promise<GenerateOutput> {
  const fetcher = input.fetcher ?? defaultFetcher;
  const concurrency = input.concurrency ?? 6;
  const now = input.now ?? (() => new Date());
  const pagesById = new Map<string, Page>();
  for (const p of input.pages) pagesById.set(p.id, p);
  const pagesByUrl = new Map<string, Page>();
  for (const p of input.pages) pagesByUrl.set(p.url, p);

  // ── Plan: which source URLs need to be fetched? ─────────────────────
  // Subject-is-source: just the subject. Subject-is-target: every candidate
  // source page. We deduplicate so the same URL is fetched once.
  const sourceUrls = new Set<string>();
  for (const issue of input.issues) {
    const cfg = RULES_LIMIT_AND_DIRECTION[issue.rule_id];
    if (!cfg) continue;
    const subject = resolveSubjectPage(issue, pagesById, pagesByUrl);
    if (!subject) continue;
    if (cfg.direction === "subject_is_source") {
      sourceUrls.add(subject.url);
    } else {
      for (const p of input.pages) {
        if (p.id === subject.id) continue;
        if (!isUsableSource(p)) continue;
        if (cfg.require_nav_source && !(p.is_nav_page === true || p.page_type === "home")) continue;
        sourceUrls.add(p.url);
      }
    }
  }

  const blocksByUrl = await fetchAndExtract(Array.from(sourceUrls), fetcher, concurrency);

  // ── Per-issue: build phrases for the target, scan source(s), rank, pick ──
  const proposals: GenerateOutput["proposals"] = [];
  const failures: GenerateOutput["failures"] = [];

  for (const issue of input.issues) {
    const cfg = RULES_LIMIT_AND_DIRECTION[issue.rule_id];
    if (!cfg) continue;
    const subject = resolveSubjectPage(issue, pagesById, pagesByUrl);
    if (!subject) {
      failures.push({ issue_id: issue.id, reason: "subject page not found" });
      continue;
    }

    let candidates: Candidate[] = [];

    if (cfg.direction === "subject_is_source") {
      const sourceBlocks = blocksByUrl.get(subject.url);
      if (!sourceBlocks || sourceBlocks.length === 0) {
        failures.push({ issue_id: issue.id, reason: "could not fetch or extract source page body" });
        continue;
      }
      // Try every other indexable page as a possible target. For each, build
      // its phrase set, scan source for matches.
      for (const target of input.pages) {
        if (target.id === subject.id) continue;
        if (!isUsableTarget(target)) continue;
        const phrases = buildPhraseCandidates({ target, brand: input.brand, keywords: input.keywords });
        if (phrases.length === 0) continue;
        const matches = scanBody(sourceBlocks, phrases);
        for (const m of matches) {
          candidates.push({ source: subject, target, block: sourceBlocks[m.block_index], match: m });
        }
      }
    } else {
      // Skip in-body link proposals when the target is already a main-nav page:
      // every page on the site already links to it via the nav, so an in-body
      // link is duplicative authority. R047 (subject_is_source) is unaffected —
      // that rule is about adding outbound links from the subject, not adding
      // inbound links to it.
      if (subject.is_nav_page === true || subject.page_type === "home") {
        failures.push({ issue_id: issue.id, reason: "target is a nav/home page — already linked sitewide; skipping in-body link" });
        continue;
      }
      const phrases = buildPhraseCandidates({ target: subject, brand: input.brand, keywords: input.keywords });
      if (phrases.length === 0) {
        failures.push({ issue_id: issue.id, reason: "target page has no usable anchor candidates (h1/title/headings empty)" });
        continue;
      }
      for (const source of input.pages) {
        if (source.id === subject.id) continue;
        if (!isUsableSource(source)) continue;
        if (cfg.require_nav_source && !(source.is_nav_page === true || source.page_type === "home")) continue;
        const sourceBlocks = blocksByUrl.get(source.url);
        if (!sourceBlocks || sourceBlocks.length === 0) continue;
        const matches = scanBody(sourceBlocks, phrases);
        for (const m of matches) {
          candidates.push({ source, target: subject, block: sourceBlocks[m.block_index], match: m });
        }
      }
    }

    const picks = pickTopCandidates(candidates, { limit: cfg.limit, require_nav_source: cfg.require_nav_source });
    if (picks.length === 0) {
      failures.push({
        issue_id: issue.id,
        reason: cfg.direction === "subject_is_source"
          ? "no exact-match anchor found for any candidate target on this page"
          : "no other page on the site contains a phrase derived from this page's title/h1/headings",
      });
      continue;
    }

    for (const pick of picks) {
      // Phrase alternatives: other phrases that also match on the same
      // (source, target) pair. Used by the Changes writer to vary anchor text
      // when the same phrase has been used too many times for this target.
      const alternativesSeen = new Set<string>([pick.match.phrase.text]);
      const phraseCandidates: string[] = [];
      for (const c of candidates) {
        if (c.source.url !== pick.source.url) continue;
        if (c.target.url !== pick.target.url) continue;
        const text = c.match.phrase.text;
        if (alternativesSeen.has(text)) continue;
        alternativesSeen.add(text);
        phraseCandidates.push(text);
        if (phraseCandidates.length >= 3) break;
      }
      proposals.push({
        issue_id: issue.id,
        proposal: candidateToProposal(pick, issue.rule_id, now(), phraseCandidates),
      });
    }
  }

  // ── R050 share cap ─────────────────────────────────────────────────────
  // Once orphans/dead-ends are cleared, R050 (only-1-inbound) becomes noise:
  // most pages technically qualify, so weekly runs would be 100% R050. Trim
  // the lowest-scoring R050 proposals until they're ≤30% of the total.
  return { proposals: enforceR050Cap(proposals), failures };
}

function enforceR050Cap(
  proposals: GenerateOutput["proposals"],
): GenerateOutput["proposals"] {
  const total = proposals.length;
  if (total === 0) return proposals;
  const r050Count = proposals.filter((p) => p.proposal.rule_id === "R050").length;
  const allowed = Math.floor(total * R050_MAX_SHARE);
  if (r050Count <= allowed) return proposals;
  const toDrop = r050Count - allowed;
  // Identify the lowest-quality R050 proposals (by phrase_priority asc, etc.).
  const r050ByQuality = proposals
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.proposal.rule_id === "R050")
    .sort((a, b) => {
      const sa = a.p.proposal.score_components;
      const sb = b.p.proposal.score_components;
      if (sa.phrase_priority !== sb.phrase_priority) return sb.phrase_priority - sa.phrase_priority;
      if (sa.page_type_fit !== sb.page_type_fit) return sb.page_type_fit - sa.page_type_fit;
      return sa.authority - sb.authority;
    });
  const dropIndices = new Set(r050ByQuality.slice(0, toDrop).map((x) => x.idx));
  return proposals.filter((_, i) => !dropIndices.has(i));
}

// ─── Helpers ──────────────────────────────────────────────────────────

function resolveSubjectPage(
  issue: IssueInput,
  byId: Map<string, Page>,
  byUrl: Map<string, Page>,
): Page | null {
  if (issue.page_id && byId.has(issue.page_id)) return byId.get(issue.page_id)!;
  if (issue.page_url && byUrl.has(issue.page_url)) return byUrl.get(issue.page_url)!;
  return null;
}

function isUsableSource(p: Page): boolean {
  if (p.status_code !== 200) return false;
  if (p.is_indexable === false) return false;
  if ((p.word_count ?? 0) < 100) return false;
  return true;
}

function isUsableTarget(p: Page): boolean {
  if (p.status_code !== 200) return false;
  if (p.is_indexable === false) return false;
  if ((p.word_count ?? 0) < 100) return false;
  // Must have at least one phrase source
  if (!p.h1_text && !p.title && !p.headings?.length) return false;
  return true;
}

async function fetchAndExtract(
  urls: string[],
  fetcher: Fetcher,
  concurrency: number,
): Promise<Map<string, Block[]>> {
  const out = new Map<string, Block[]>();
  // Sort URLs so concurrent fetches happen in deterministic order — useful
  // when debugging request logs against expected output.
  const queue = [...urls].sort();
  let active = 0;
  let cursor = 0;

  await new Promise<void>((resolve) => {
    const launchNext = () => {
      while (active < concurrency && cursor < queue.length) {
        const url = queue[cursor++];
        active += 1;
        fetcher(url)
          .then((res) => {
            if (res.ok && res.html) {
              const { blocks } = extractBody(res.html);
              out.set(url, blocks);
            } else {
              out.set(url, []);
            }
          })
          .catch(() => {
            out.set(url, []);
          })
          .finally(() => {
            active -= 1;
            if (cursor >= queue.length && active === 0) resolve();
            else launchNext();
          });
      }
      if (queue.length === 0) resolve();
    };
    launchNext();
  });

  return out;
}

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "PromptiveSEO/1.0 (+https://getpromptive.ai/bot)";

const defaultFetcher: Fetcher = async (url) => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DEFAULT_FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": DEFAULT_USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, html: "" };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return { ok: false, html: "" };
    const html = await res.text();
    return { ok: true, html };
  } catch {
    return { ok: false, html: "" };
  }
};

function candidateToProposal(c: Candidate, ruleId: string, now: Date, phraseCandidates: string[] = []): LinkProposal {
  const { source, target, block, match } = c;
  const score = scoreCandidate(c);
  const display = block.text.slice(match.text_start, match.text_end);
  const htmlStart = block.text_to_html[match.text_start] ?? 0;
  const htmlEnd = block.text_to_html[match.text_end] ?? block.inner_html.length;
  const confidence: LinkProposal["confidence"] =
    score.phrase_priority <= 2 && score.page_type_fit <= 2
      ? "High"
      : score.phrase_priority <= 3 && score.page_type_fit <= 3
        ? "Medium"
        : "Low";
  const rationale = buildRationale(c, ruleId);

  return {
    version: 1,
    rule_id: ruleId,
    source_url: source.url,
    target_url: target.url,
    anchor_text: match.phrase.text,
    anchor_text_display: display,
    source_section_heading: block.section_heading,
    source_block_tag: block.tag,
    source_block_index: match.block_index,
    source_paragraph_text: block.text,
    source_paragraph_html: block.inner_html,
    anchor_text_start: match.text_start,
    anchor_text_end: match.text_end,
    anchor_html_start: htmlStart,
    anchor_html_end: htmlEnd,
    phrase_source: match.phrase.source,
    score_components: score,
    rationale,
    confidence,
    phrase_candidates: phraseCandidates.length > 0 ? phraseCandidates : undefined,
    generated_at: now.toISOString(),
  };
}

function buildRationale(c: Candidate, ruleId: string): string {
  const reasons: string[] = [];
  switch (c.match.phrase.source) {
    case "h1": reasons.push(`The anchor "${c.match.phrase.text}" is the destination page's H1 heading.`); break;
    case "title": reasons.push(`The anchor "${c.match.phrase.text}" matches the destination page's title.`); break;
    case "h2": reasons.push(`The anchor "${c.match.phrase.text}" is one of the destination page's section headings.`); break;
    case "h3": reasons.push(`The anchor "${c.match.phrase.text}" is one of the destination page's sub-headings.`); break;
    case "keyword": reasons.push(`The anchor "${c.match.phrase.text}" is a tracked keyword that the destination page targets.`); break;
  }
  if (c.block.section_heading) {
    reasons.push(`The phrase already appears in the "${c.block.section_heading}" section of the source page, so the link sits in topically relevant context.`);
  } else {
    reasons.push("The phrase already appears on the source page, so we add the link without rewriting any prose.");
  }
  switch (ruleId) {
    case "R047": reasons.push("This page currently links nowhere on your site; adding outbound context links spreads authority and helps users navigate."); break;
    case "R048": reasons.push("This page is an orphan — no other page on the site links to it. This new inbound link makes it discoverable to crawlers and visitors."); break;
    case "R049": reasons.push("This page only has one inbound link. Adding a second from a related page strengthens its topical signals."); break;
    case "R050": reasons.push("This page is buried deep in the site. Linking from a top-nav or homepage section reduces click depth so it ranks better."); break;
  }
  return reasons.join(" ");
}
