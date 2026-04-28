import type { PageRule } from "./types";

export const R042_altTextTooLong: PageRule = {
  id: "R042",
  name: "Alt text exceeds 125 characters",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "Alt text longer than ~125 characters is truncated by most screen readers and starts to feel keyword-stuffed. Aim for a concise, specific description.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const n = page.alt_text_too_long_count ?? 0;
    if (n === 0) return null;
    return {
      rule_id: "R042",
      rule_name: "Alt text exceeds 125 characters",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: `${n} image(s) with alt text over 125 characters`,
      expected_value: "Alt text is descriptive but under 125 characters.",
      evidence: { count: n },
    };
  },
};
