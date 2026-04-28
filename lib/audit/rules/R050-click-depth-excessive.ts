import type { PageRule } from "./types";

export const R050_clickDepthExcessive: PageRule = {
  id: "R050",
  name: "Page is more than 4 clicks from the homepage",
  severity: "medium",
  category: "content",
  scope: "page",
  description:
    "Pages buried deep in the link graph are crawled less often and pass less authority. Important pages should be reachable in 3 clicks or fewer from the homepage.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.is_indexable === false) return null;
    const d = page.click_depth;
    if (d === null || d <= 4) return null;
    return {
      rule_id: "R050",
      rule_name: "Page is more than 4 clicks from the homepage",
      severity: "medium",
      category: "content",
      scope: "page",
      current_value: `${d} clicks deep`,
      expected_value: "3 or fewer clicks from the homepage for important pages.",
      evidence: { click_depth: d },
    };
  },
};
