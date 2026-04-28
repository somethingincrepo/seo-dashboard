import type { PageRule } from "./types";

export const R022_urlWhitespace: PageRule = {
  id: "R022",
  name: "URL contains whitespace or unsafe characters",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "URLs containing encoded spaces (%20) or special characters are harder to share, copy, and parse. They often indicate auto-generated slugs that should be cleaned up.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    let path = "";
    try { path = new URL(page.url).pathname; } catch { return null; }
    if (!/%20| |[^a-zA-Z0-9\-_/.]/.test(path)) return null;
    return {
      rule_id: "R022",
      rule_name: "URL contains whitespace or unsafe characters",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: path,
      expected_value: "Hyphen-separated, alphanumeric URL slug (no spaces, %20, or punctuation).",
      evidence: { path },
    };
  },
};
