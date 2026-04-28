import type { PageRule } from "./types";

export const R039_jsonldInvalid: PageRule = {
  id: "R039",
  name: "JSON-LD block fails to parse",
  severity: "high",
  category: "on-page",
  scope: "page",
  description:
    "Invalid JSON-LD is silently ignored by search engines, meaning all the structured data benefit is lost. Even one bad block on the page can be a wasted opportunity.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const n = page.schema_invalid_count ?? 0;
    if (n === 0) return null;
    return {
      rule_id: "R039",
      rule_name: "JSON-LD block fails to parse",
      severity: "high",
      category: "on-page",
      scope: "page",
      current_value: `${n} invalid JSON-LD block(s)`,
      expected_value: "All <script type=\"application/ld+json\"> blocks parse as valid JSON.",
      evidence: { invalid_count: n },
    };
  },
};
