import type { PageRule } from "./types";

export const R007_noindexInSitemap: PageRule = {
  id: "R007",
  name: "Noindex page is included in sitemap",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "Sitemaps should only contain canonical, indexable URLs. Listing a noindex page wastes crawl budget and signals contradictory intent to search engines.",
  check: (page) => {
    if (!page.in_sitemap) return null;
    if (page.noindex !== true) return null;
    return {
      rule_id: "R007",
      rule_name: "Noindex page is included in sitemap",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: "noindex + in sitemap",
      expected_value: "Either remove noindex or remove the URL from the sitemap.",
    };
  },
};
