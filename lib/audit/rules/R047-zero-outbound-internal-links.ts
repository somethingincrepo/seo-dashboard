import type { PageRule } from "./types";

export const R047_zeroOutboundInternalLinks: PageRule = {
  id: "R047",
  name: "Page has no outbound internal links",
  severity: "medium",
  category: "content",
  scope: "page",
  description:
    "Internal links spread authority and help users navigate. A page with zero outbound links is a dead end that traps both link equity and visitors.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.is_indexable === false) return null;
    const out = page.internal_links_out;
    if (out === null || out > 0) return null;
    return {
      rule_id: "R047",
      rule_name: "Page has no outbound internal links",
      severity: "medium",
      category: "content",
      scope: "page",
      current_value: "0 outbound internal links",
      expected_value: "At least 2-3 contextual internal links to related pages.",
    };
  },
};
