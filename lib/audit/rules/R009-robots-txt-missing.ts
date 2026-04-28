import type { SiteRule } from "./types";

export const R009_robotsTxtMissing: SiteRule = {
  id: "R009",
  name: "robots.txt is missing",
  severity: "medium",
  category: "technical",
  scope: "site",
  description:
    "robots.txt is the first file search engine crawlers check. Without it, crawlers fall back to defaults and you cannot reference your sitemap or block private paths.",
  check: ({ site }) => {
    if (site.robots_txt_present === true) return null;
    return {
      rule_id: "R009",
      rule_name: "robots.txt is missing",
      severity: "medium",
      category: "technical",
      scope: "site",
      current_value: "/robots.txt returns 404",
      expected_value: "A robots.txt at the site root, including a Sitemap: directive.",
    };
  },
};
