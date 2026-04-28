import type { SiteRule } from "./types";

export const R063_llmsTxtMissing: SiteRule = {
  id: "R063",
  name: "/llms.txt is missing",
  severity: "low",
  category: "ai-geo",
  scope: "site",
  description:
    "llms.txt is the emerging convention for declaring an AI-readable summary of a site, akin to robots.txt for search. Sites without it are harder for AI assistants to summarize accurately.",
  check: ({ site }) => {
    if (site.llms_txt_present === true) return null;
    return {
      rule_id: "R063",
      rule_name: "/llms.txt is missing",
      severity: "low",
      category: "ai-geo",
      scope: "site",
      current_value: "/llms.txt returns 404",
      expected_value: "An llms.txt at the site root summarizing the site's purpose and key URLs.",
    };
  },
};
