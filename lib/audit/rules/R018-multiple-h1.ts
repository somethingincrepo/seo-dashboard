import type { PageRule } from "./types";

export const R018_multipleH1: PageRule = {
  id: "R018",
  name: "Page has multiple H1 tags",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "An H1 declares the page's primary topic. Multiple H1s dilute that signal and usually indicate template or copy-paste mistakes rather than intentional structure.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const count = page.h1_count ?? 0;
    if (count <= 1) return null;
    return {
      rule_id: "R018",
      rule_name: "Page has multiple H1 tags",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: `${count} H1 tags on the page`,
      expected_value: "Exactly one H1 per page.",
      evidence: { h1_count: count },
    };
  },
};
