import type { SiteRule } from "./types";

export const R011_sitemapContainsBrokenUrls: SiteRule = {
  id: "R011",
  name: "Sitemap contains URLs returning non-200",
  severity: "high",
  category: "technical",
  scope: "site",
  description:
    "Every URL in the sitemap should resolve to a live indexable page. 404s and redirects in the sitemap waste crawl budget and signal a poorly maintained site.",
  check: ({ allPages, site }) => {
    if (!site.sitemap_urls || site.sitemap_urls.length === 0) return null;
    const sitemapSet = new Set(site.sitemap_urls);
    const broken: string[] = [];
    for (const p of allPages) {
      if (!sitemapSet.has(p.url)) continue;
      if (p.status_code !== null && p.status_code !== 200) broken.push(p.url);
    }
    if (broken.length === 0) return null;
    return {
      rule_id: "R011",
      rule_name: "Sitemap contains URLs returning non-200",
      severity: "high",
      category: "technical",
      scope: "site",
      current_value: `${broken.length} broken URL(s) in sitemap`,
      expected_value: "All sitemap URLs return HTTP 200.",
      evidence: { broken_sample: broken.slice(0, 20), count: broken.length },
    };
  },
};
