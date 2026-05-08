import type { AuditIssue } from "./queries";

/**
 * Site-health score (0–100). Plain absolute-weight model:
 *
 *   penalty = (criticals × 5) + (highs × 1.5) + (mediums × 0.4) + (lows × 0.05)
 *   score   = max(0, 100 − penalty)
 *
 * This used to do a per-page cap + normalization-against-worst-case, which
 * was easier to defend mathematically but harder to explain ("why is my
 * score 41%?"). The flat weights below let customers reason directly: each
 * critical you fix gives back 5 points, each high gives back 1.5, etc. No
 * normalization, no scaling — what you see in the breakdown is what it
 * subtracts from 100.
 *
 * Calibration targets (typical-site sanity check):
 *   - Healthy small site, only low/medium findings:        85–95%
 *   - Decent site with several highs:                      55–75%
 *   - Site with multiple criticals + dozens of highs:        0–30%
 *
 * Dismissed issues are excluded by the caller before invoking this — that
 * way a customer dismissing a false positive sees the number move up. The
 * `pagesCrawled` argument is kept for forward compatibility (older callers
 * may want it for a per-page-density hybrid later) but is currently unused.
 */
export const SEVERITY_WEIGHTS = {
  critical: 5,
  high: 1.5,
  medium: 0.4,
  low: 0.05,
} as const;

export function computeHealthScore(issues: AuditIssue[], pagesCrawled: number): number {
  if (pagesCrawled <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(100 - computePenalty(issues))));
}

export function computePenalty(issues: AuditIssue[]): number {
  let p = 0;
  for (const i of issues) {
    p += SEVERITY_WEIGHTS[(i.severity ?? "").toLowerCase() as keyof typeof SEVERITY_WEIGHTS] ?? 0;
  }
  return p;
}

export function severityCounts(issues: AuditIssue[]): {
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const i of issues) {
    const k = (i.severity ?? "").toLowerCase();
    if (k === "critical" || k === "high" || k === "medium" || k === "low") c[k]++;
  }
  return c;
}
