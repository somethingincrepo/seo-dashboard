import type { PageRule } from "./types";

export const R062_internalLinksOutExcessive: PageRule = {
  id: "R062",
  name: "Page has more than 200 outbound internal links",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "Pages with hundreds of links dilute the authority each one passes and overwhelm crawlers. This usually indicates a sitemap-style page mis-cast as a regular page.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const out = page.internal_links_out ?? 0;
    if (out <= 200) return null;
    return {
      rule_id: "R062",
      rule_name: "Page has more than 200 outbound internal links",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: `${out} outbound internal links`,
      expected_value: "Under 100 contextual internal links per page.",
      evidence: { internal_links_out: out },
    };
  },
};
