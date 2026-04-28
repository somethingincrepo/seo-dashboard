import type { PageRule } from "./types";

export const R028_metaDescriptionMissing: PageRule = {
  id: "R028",
  name: "Meta description is missing",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "When the meta description is missing, search engines auto-generate a snippet from page text — usually less compelling than one written deliberately. Click-through rate drops.",
  check: (page) => {
    if (page.status_code !== 200 || page.is_indexable === false) return null;
    if (page.meta_description && page.meta_description.trim().length > 0) return null;
    return {
      rule_id: "R028",
      rule_name: "Meta description is missing",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: "(missing)",
      expected_value: "A 70–160 character description that summarizes the page and encourages clicks.",
    };
  },
};
