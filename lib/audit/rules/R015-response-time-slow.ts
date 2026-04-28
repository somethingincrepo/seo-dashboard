import type { PageRule } from "./types";

export const R015_responseTimeSlow: PageRule = {
  id: "R015",
  name: "Page response time exceeds 3 seconds",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "Slow time-to-first-byte degrades both Core Web Vitals and user experience. Pages over 3 seconds need server, CDN, or caching investigation.",
  check: (page) => {
    const ms = page.response_time_ms;
    if (ms === null) return null;
    if (ms < 3000) return null;
    if (ms >= 5000) return null;
    return {
      rule_id: "R015",
      rule_name: "Page response time exceeds 3 seconds",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: `${(ms / 1000).toFixed(2)}s response time`,
      expected_value: "Under 3 seconds (ideally under 1 second).",
      evidence: { response_time_ms: ms },
    };
  },
};
