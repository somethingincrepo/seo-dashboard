import type { PageRule } from "./types";

export const R016_responseTimeCritical: PageRule = {
  id: "R016",
  name: "Page response time exceeds 5 seconds",
  severity: "high",
  category: "technical",
  scope: "page",
  description:
    "Pages taking more than 5 seconds to respond are effectively unusable on mobile networks and will be deprioritized by search engines as a poor user experience.",
  check: (page) => {
    const ms = page.response_time_ms;
    if (ms === null || ms < 5000) return null;
    return {
      rule_id: "R016",
      rule_name: "Page response time exceeds 5 seconds",
      severity: "high",
      category: "technical",
      scope: "page",
      current_value: `${(ms / 1000).toFixed(2)}s response time`,
      expected_value: "Under 3 seconds (ideally under 1 second).",
      evidence: { response_time_ms: ms },
    };
  },
};
