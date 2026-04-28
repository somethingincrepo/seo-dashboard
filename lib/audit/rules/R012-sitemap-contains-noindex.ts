import type { SiteRule } from "./types";

export const R012_sitemapContainsNoindex: SiteRule = {
  id: "R012",
  name: "Sitemap contains noindex pages",
  severity: "medium",
  category: "technical",
  scope: "site",
  description:
    "A sitemap should be the canonical list of pages you want indexed. Including noindex pages sends contradictory signals and wastes crawl budget.",
  check: ({ allPages, site }) => {
    if (!site.sitemap_urls || site.sitemap_urls.length === 0) return null;
    const sitemapSet = new Set(site.sitemap_urls);
    const offenders: string[] = [];
    for (const p of allPages) {
      if (!sitemapSet.has(p.url)) continue;
      if (p.noindex === true) offenders.push(p.url);
    }
    if (offenders.length === 0) return null;
    return {
      rule_id: "R012",
      rule_name: "Sitemap contains noindex pages",
      severity: "medium",
      category: "technical",
      scope: "site",
      current_value: `${offenders.length} noindex page(s) in sitemap`,
      expected_value: "Sitemap lists only indexable pages.",
      evidence: { sample: offenders.slice(0, 20), count: offenders.length },
    };
  },
};
