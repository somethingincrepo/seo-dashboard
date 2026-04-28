import type { PageRule } from "./types";

export const R004_canonicalMissing: PageRule = {
  id: "R004",
  name: "Canonical tag is missing",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "Without a canonical link, search engines guess which URL variant to index. Every indexable page should declare its canonical URL explicitly.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.is_indexable === false) return null;
    if (page.canonical_url && page.canonical_url.trim().length > 0) return null;
    return {
      rule_id: "R004",
      rule_name: "Canonical tag is missing",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: "(no canonical tag)",
      expected_value: "A self-referencing <link rel=\"canonical\"> in <head>.",
    };
  },
};
