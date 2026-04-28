import type { PageRule } from "./types";

export const R057_placeholderText: PageRule = {
  id: "R057",
  name: "Page contains placeholder or filler text",
  severity: "high",
  category: "content",
  scope: "page",
  description:
    "Lorem ipsum, \"TODO\", and \"coming soon\" left in production pages signal an unfinished build to both users and search engines, killing trust on first read.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const found = page.placeholder_text_found ?? [];
    if (found.length === 0) return null;
    return {
      rule_id: "R057",
      rule_name: "Page contains placeholder or filler text",
      severity: "high",
      category: "content",
      scope: "page",
      current_value: `Found: ${found.join(", ")}`,
      expected_value: "All visible text is final, intentional copy.",
      evidence: { matches: found },
    };
  },
};
