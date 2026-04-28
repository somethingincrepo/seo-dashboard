import type { PageRule } from "./types";

export const R008_noindexOnNavPage: PageRule = {
  id: "R008",
  name: "Noindex set on a primary nav page",
  severity: "critical",
  category: "technical",
  scope: "page",
  description:
    "Noindex on a page linked from the primary navigation is almost always a mistake — it removes a key page from search results.",
  check: (page) => {
    if (page.is_nav_page !== true) return null;
    if (page.noindex !== true) return null;
    return {
      rule_id: "R008",
      rule_name: "Noindex set on a primary nav page",
      severity: "critical",
      category: "technical",
      scope: "page",
      current_value: "noindex set on a navigation page",
      expected_value: "Indexable (no noindex) — this page should be findable in search.",
    };
  },
};
