import type { PageRule } from "./types";

export const R021_urlUppercase: PageRule = {
  id: "R021",
  name: "URL contains uppercase characters",
  severity: "low",
  category: "technical",
  scope: "page",
  description:
    "URLs are case-sensitive on most servers. Uppercase characters create silent duplicate-content risk because case variants are treated as distinct URLs.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    let path = "";
    try { path = new URL(page.url).pathname; } catch { return null; }
    if (path === path.toLowerCase()) return null;
    return {
      rule_id: "R021",
      rule_name: "URL contains uppercase characters",
      severity: "low",
      category: "technical",
      scope: "page",
      current_value: path,
      expected_value: "All-lowercase URL path.",
      evidence: { path },
    };
  },
};
