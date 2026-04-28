import type { PageRule } from "./types";

export const R032_metaDescriptionMatchesTitle: PageRule = {
  id: "R032",
  name: "Meta description is identical to the title",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "When the description repeats the title verbatim, the SERP shows the same text twice. Use the description to add context or benefits the title can't fit.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const t = page.title?.trim().toLowerCase();
    const d = page.meta_description?.trim().toLowerCase();
    if (!t || !d || t !== d) return null;
    return {
      rule_id: "R032",
      rule_name: "Meta description is identical to the title",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: `"${page.meta_description}"`,
      expected_value: "Description distinct from the title — adds context, benefit, or call to action.",
    };
  },
};
