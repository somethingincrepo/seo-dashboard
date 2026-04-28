import type { PageRule } from "./types";

export const R023_titleMissing: PageRule = {
  id: "R023",
  name: "Title tag is missing or empty",
  severity: "high",
  category: "on-page",
  scope: "page",
  description:
    "The <title> tag is the primary label for a page in search results and browser tabs. Every indexable page needs a non-empty, descriptive title.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.is_indexable === false) return null;
    if (page.title && page.title.trim().length > 0) return null;
    return {
      rule_id: "R023",
      rule_name: "Title tag is missing or empty",
      severity: "high",
      category: "on-page",
      scope: "page",
      current_value: "(missing)",
      expected_value: "A descriptive title tag, 30–60 characters, including the primary keyword.",
    };
  },
};
