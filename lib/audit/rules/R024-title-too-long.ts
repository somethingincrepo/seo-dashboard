import type { PageRule } from "./types";

export const R024_titleTooLong: PageRule = {
  id: "R024",
  name: "Title tag exceeds 60 characters",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Search engines truncate titles around 60 characters. Anything longer is cut off in the SERP, often at the worst possible spot — mid-keyword or mid-brand.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const len = page.title_length ?? 0;
    if (len <= 60) return null;
    return {
      rule_id: "R024",
      rule_name: "Title tag exceeds 60 characters",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: `${len} characters: "${page.title ?? ""}"`,
      expected_value: "30–60 characters.",
      evidence: { title_length: len },
    };
  },
};
