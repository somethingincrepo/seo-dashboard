import type { PageRule } from "./types";

export const R033_h1Missing: PageRule = {
  id: "R033",
  name: "H1 tag is missing",
  severity: "high",
  category: "on-page",
  scope: "page",
  description:
    "The H1 declares the page's primary topic and is a major on-page ranking and accessibility signal. Every page should have exactly one descriptive H1.",
  check: (page) => {
    if (page.status_code !== 200 || page.is_indexable === false) return null;
    const count = page.h1_count ?? 0;
    if (count >= 1) return null;
    return {
      rule_id: "R033",
      rule_name: "H1 tag is missing",
      severity: "high",
      category: "on-page",
      scope: "page",
      current_value: "(no H1 on the page)",
      expected_value: "A single H1 that names the page's primary topic.",
    };
  },
};
