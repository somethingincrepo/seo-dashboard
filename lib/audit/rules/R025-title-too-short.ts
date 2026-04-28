import type { PageRule } from "./types";

export const R025_titleTooShort: PageRule = {
  id: "R025",
  name: "Title tag is shorter than 30 characters",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "Very short titles waste valuable SERP real estate. A title under 30 characters usually means there's room to add a descriptor or modifier that helps both users and ranking.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const len = page.title_length ?? 0;
    if (len === 0) return null; // covered by R023
    if (len >= 30) return null;
    return {
      rule_id: "R025",
      rule_name: "Title tag is shorter than 30 characters",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: `${len} characters: "${page.title ?? ""}"`,
      expected_value: "30–60 characters.",
      evidence: { title_length: len },
    };
  },
};
