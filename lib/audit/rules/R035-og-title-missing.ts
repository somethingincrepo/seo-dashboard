import type { PageRule } from "./types";

export const R035_ogTitleMissing: PageRule = {
  id: "R035",
  name: "Open Graph title is missing",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "Without og:title, social platforms fall back to the <title> tag, which is often optimized for SERPs rather than feeds. Pages shared on social networks lose visual distinctiveness.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.og_title && page.og_title.trim().length > 0) return null;
    return {
      rule_id: "R035",
      rule_name: "Open Graph title is missing",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: "(no og:title)",
      expected_value: "<meta property=\"og:title\" content=\"...\"> — typically a more punchy version of the page title.",
    };
  },
};
