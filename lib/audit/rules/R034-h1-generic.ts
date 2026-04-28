import type { PageRule } from "./types";

const GENERIC_H1S = new Set([
  "welcome", "welcome!", "home", "homepage", "hello", "hi", "hello world",
  "untitled", "page", "main", "default", "blog", "article",
]);

export const R034_h1Generic: PageRule = {
  id: "R034",
  name: "H1 is generic boilerplate",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Generic H1s like \"Welcome\" or \"Home\" tell search engines nothing about what the page is for. The H1 is one of the strongest topical signals — make it specific.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const h1 = page.h1_text?.trim().toLowerCase();
    if (!h1 || !GENERIC_H1S.has(h1)) return null;
    return {
      rule_id: "R034",
      rule_name: "H1 is generic boilerplate",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: `"${page.h1_text}"`,
      expected_value: "An H1 that names the page's primary topic and includes the target keyword.",
    };
  },
};
