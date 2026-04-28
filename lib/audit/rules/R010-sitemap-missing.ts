import type { SiteRule } from "./types";

export const R010_sitemapMissing: SiteRule = {
  id: "R010",
  name: "XML sitemap is missing",
  severity: "high",
  category: "technical",
  scope: "site",
  description:
    "An XML sitemap is the primary signal you give search engines about which URLs exist and matter on your site. Without one, discovery relies on internal linking alone.",
  check: ({ site }) => {
    if (site.sitemap_present === true) return null;
    return {
      rule_id: "R010",
      rule_name: "XML sitemap is missing",
      severity: "high",
      category: "technical",
      scope: "site",
      current_value: "No sitemap.xml found at common paths",
      expected_value: "A discoverable XML sitemap referenced from robots.txt.",
    };
  },
};
