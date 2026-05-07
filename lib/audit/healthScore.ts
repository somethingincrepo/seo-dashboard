import type { AuditIssue } from "./queries";

/**
 * Site-health score (0–100).
 *
 * The previous formula was `(pagesWithoutIssues / pagesCrawled) * 100`. In
 * practice every audited page has at least one finding (a missing og:image, a
 * thin paragraph, an over-long meta title) so that ratio rounds to 0% on every
 * real site. The score then doesn't move when customers fix critical issues
 * either, because as long as one trivial issue remains on a page the page
 * still counts as "affected."
 *
 * This replacement weights deductions by severity and caps how much any one
 * page (or the site bucket) can drag the overall score:
 *
 *   per-issue weights:  critical 10 · high 5 · medium 1.5 · low 0.3
 *   per-page cap:       15 points (one bad page can't tank the whole score)
 *   normalization:      worst case = (pages + site bucket) × 15
 *
 * Properties this gives us:
 *   - A site with only low-severity findings (typical for a healthy small
 *     site) lands in the 90s.
 *   - A site with several high/critical issues drops into the 30–60 range.
 *   - Clearing critical issues moves the score visibly even if low-severity
 *     ones remain — the metric rewards the work that matters.
 *   - The score only hits 0 when the site is genuinely broken at scale.
 *
 * The number is meant for orientation, not academic rigor — small wording
 * changes to the issue rules will shift it. That's fine. What matters is
 * that customers see a meaningful starting score that improves as they
 * implement the recommendations.
 */
export function computeHealthScore(issues: AuditIssue[], pagesCrawled: number): number {
  if (pagesCrawled <= 0) return 100;

  const weights: Record<string, number> = {
    critical: 10,
    high: 5,
    medium: 1.5,
    low: 0.3,
  };
  const PER_PAGE_CAP = 15;

  // Sum weighted deductions per page (and a single bucket for site-scoped
  // issues, so e.g. a missing sitemap docks the score once, not per page).
  const perBucket = new Map<string, number>();
  for (const issue of issues) {
    const bucket = issue.scope === "site"
      ? "__site__"
      : issue.page_url ?? "__unknown__";
    const w = weights[(issue.severity ?? "").toLowerCase()] ?? 0;
    perBucket.set(bucket, (perBucket.get(bucket) ?? 0) + w);
  }

  let totalDeduction = 0;
  for (const sum of perBucket.values()) {
    totalDeduction += Math.min(sum, PER_PAGE_CAP);
  }

  // Worst case: every crawled page plus the site bucket hits the cap.
  const maxDeduction = (pagesCrawled + 1) * PER_PAGE_CAP;
  const score = 100 - (totalDeduction / maxDeduction) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}
