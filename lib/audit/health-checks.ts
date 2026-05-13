import type { AuditRunSummary, AuditIssue } from "./queries";
import { getFixGuidance } from "./rules/fix-guidance";

export type HealthStatus = "ok" | "fail" | "warn" | "unknown";

export interface HealthCheck {
  /** Stable id for keying */
  id: string;
  /** Group name for sectioning the page */
  group: "Security" | "Discoverability" | "AI readiness" | "Indexability" | "Structure";
  /** Headline label */
  label: string;
  /** Plain-English explanation of what this check is */
  why: string;
  /** "ok" | "fail" | "warn" | "unknown" */
  status: HealthStatus;
  /** Extra detail that explains the current status */
  detail?: string;
  /** Optional related rule_id (used to deep-link into the issues page filtered to that rule) */
  rule_id?: string;
  /** Actionable fix instruction — populated when status is fail or warn */
  fix_guidance?: string;
}

/**
 * Compute the comprehensive site-health checklist from a completed audit run
 * and its issues. All rows are derived — no extra DB calls needed.
 */
export function buildHealthChecks(run: AuditRunSummary, issues: AuditIssue[]): HealthCheck[] {
  // Convenience indexers
  const issuesByRule = new Map<string, AuditIssue[]>();
  for (const i of issues) {
    if (!issuesByRule.has(i.rule_id)) issuesByRule.set(i.rule_id, []);
    issuesByRule.get(i.rule_id)!.push(i);
  }
  const count = (rule: string) => issuesByRule.get(rule)?.length ?? 0;
  const flag = (b: boolean | null): HealthStatus => (b === true ? "ok" : b === false ? "fail" : "unknown");

  const checks: HealthCheck[] = [];

  // ── Security ──────────────────────────────────────────────────────────
  checks.push({
    id: "https",
    group: "Security",
    label: "HTTPS enforced",
    why: "All HTTP traffic should redirect to HTTPS so users and search engines never load an insecure version of your pages.",
    status: flag(run.https_enforced),
    detail: run.https_enforced === false ? "Your http:// origin doesn't 301 to https://." : undefined,
    rule_id: "R013",
  });
  checks.push({
    id: "hsts",
    group: "Security",
    label: "HSTS header present",
    why: "Strict-Transport-Security tells browsers to only ever connect over HTTPS, blocking downgrade attacks.",
    status: flag(run.hsts_header_present),
    detail: run.hsts_header_present === false ? "No Strict-Transport-Security header on the homepage response." : undefined,
    rule_id: "R014",
  });

  // ── Discoverability (crawlers + search) ───────────────────────────────
  checks.push({
    id: "robots",
    group: "Discoverability",
    label: "robots.txt published",
    why: "robots.txt is the first file every crawler checks. It declares your sitemap and which paths to skip.",
    status: flag(run.robots_txt_present),
    detail: run.robots_txt_present === false ? "/robots.txt returns 404 — search engines fall back to defaults." : undefined,
    rule_id: "R009",
  });
  checks.push({
    id: "sitemap",
    group: "Discoverability",
    label: "XML sitemap published",
    why: "Your primary signal to search engines about which URLs exist and matter on your site.",
    status: flag(run.sitemap_present),
    detail: run.sitemap_present === false ? "No sitemap.xml found at common paths or referenced in robots.txt." : undefined,
    rule_id: "R010",
  });
  // Sitemap quality (only if sitemap exists)
  const sitemapBrokenCount = count("R011");
  checks.push({
    id: "sitemap-clean-200",
    group: "Discoverability",
    label: "Sitemap free of broken URLs",
    why: "Every URL in the sitemap should return 200. 404s and redirects waste crawl budget and signal a poorly maintained site.",
    status: run.sitemap_present === false ? "unknown" : sitemapBrokenCount === 0 ? "ok" : "fail",
    detail: sitemapBrokenCount > 0 ? `${sitemapBrokenCount} sitemap URL${sitemapBrokenCount === 1 ? "" : "s"} returning non-200.` : undefined,
    rule_id: "R011",
  });
  const sitemapNoindexCount = count("R012");
  checks.push({
    id: "sitemap-clean-noindex",
    group: "Discoverability",
    label: "Sitemap free of noindex pages",
    why: "A sitemap should be the canonical list of pages you want indexed. Listing noindex URLs sends contradictory signals.",
    status: run.sitemap_present === false ? "unknown" : sitemapNoindexCount === 0 ? "ok" : "fail",
    detail: sitemapNoindexCount > 0 ? `${sitemapNoindexCount} noindex URL${sitemapNoindexCount === 1 ? "" : "s"} in the sitemap.` : undefined,
    rule_id: "R012",
  });

  // ── AI readiness ──────────────────────────────────────────────────────
  checks.push({
    id: "llms-txt",
    group: "AI readiness",
    label: "/llms.txt published",
    why: "An emerging convention that lets AI assistants summarize your site accurately. Sites without it are harder to cite.",
    status: flag(run.llms_txt_present),
    detail: run.llms_txt_present === false ? "/llms.txt returns 404." : undefined,
    rule_id: "R063",
  });
  checks.push({
    id: "llms-full-txt",
    group: "AI readiness",
    label: "/llms-full.txt published",
    why: "Long-form companion to llms.txt — full text of every key page in one document. Substantially boosts AI answer quality.",
    status: flag(run.llms_full_txt_present),
    detail: run.llms_full_txt_present === false ? "/llms-full.txt returns 404." : undefined,
    rule_id: "R064",
  });
  // Organization schema on homepage
  const orgMissingCount = count("R040");
  checks.push({
    id: "org-schema-home",
    group: "AI readiness",
    label: "Organization schema on homepage",
    why: "Tells search engines and AI assistants your brand's name, logo, and identity links — the foundational entity declaration.",
    status: orgMissingCount === 0 ? "ok" : "fail",
    detail: orgMissingCount > 0 ? "Homepage Organization JSON-LD is missing." : undefined,
    rule_id: "R040",
  });

  // ── Indexability ──────────────────────────────────────────────────────
  const non200Count = count("R001");
  checks.push({
    id: "no-broken-pages",
    group: "Indexability",
    label: "No 4xx/5xx pages discovered",
    why: "Crawled pages returning errors are dead ends for users and search engines alike.",
    status: non200Count === 0 ? "ok" : "fail",
    detail: non200Count > 0 ? `${non200Count} page${non200Count === 1 ? "" : "s"} returned non-OK status during crawl.` : undefined,
    rule_id: "R001",
  });
  const navNoindexCount = count("R008");
  checks.push({
    id: "nav-pages-indexable",
    group: "Indexability",
    label: "No noindex on nav pages",
    why: "Navigation pages should always be findable in search. Noindex on them is almost always a mistake.",
    status: navNoindexCount === 0 ? "ok" : "fail",
    detail: navNoindexCount > 0 ? `${navNoindexCount} nav page${navNoindexCount === 1 ? "" : "s"} have noindex set.` : undefined,
    rule_id: "R008",
  });
  const canonicalBrokenCount = count("R005") + count("R006");
  checks.push({
    id: "canonicals-healthy",
    group: "Indexability",
    label: "Canonicals point to live, same-domain URLs",
    why: "A canonical pointing to a 404 or another domain effectively asks search engines to index nothing or someone else's page.",
    status: canonicalBrokenCount === 0 ? "ok" : "fail",
    detail: canonicalBrokenCount > 0 ? `${canonicalBrokenCount} page${canonicalBrokenCount === 1 ? "" : "s"} have broken or cross-domain canonicals.` : undefined,
    rule_id: "R005",
  });

  // ── Structure ─────────────────────────────────────────────────────────
  const hreflangBadCount = count("R020");
  checks.push({
    id: "hreflang-valid",
    group: "Structure",
    label: "Hreflang configuration valid (where present)",
    why: "If you have hreflang tags, they must use valid ISO codes and be reciprocal. Invalid hreflang is silently ignored by search engines.",
    status: hreflangBadCount === 0 ? "ok" : "warn",
    detail: hreflangBadCount > 0 ? `${hreflangBadCount} page${hreflangBadCount === 1 ? "" : "s"} have invalid hreflang.` : undefined,
    rule_id: "R020",
  });
  const mixedContentCount = count("R003");
  checks.push({
    id: "no-mixed-content",
    group: "Structure",
    label: "No mixed-content resources",
    why: "Loading http:// resources from an https:// page triggers browser warnings and can cause requests to fail entirely.",
    status: mixedContentCount === 0 ? "ok" : "fail",
    detail: mixedContentCount > 0 ? `${mixedContentCount} page${mixedContentCount === 1 ? "" : "s"} load HTTP resources over HTTPS.` : undefined,
    rule_id: "R003",
  });

  // Attach fix guidance to every failing/warning check that has a rule_id
  for (const check of checks) {
    if ((check.status === "fail" || check.status === "warn") && check.rule_id) {
      check.fix_guidance = getFixGuidance(check.rule_id);
    }
  }

  return checks;
}
