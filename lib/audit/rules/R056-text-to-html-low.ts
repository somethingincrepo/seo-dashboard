import type { PageRule } from "./types";

export const R056_textToHtmlLow: PageRule = {
  id: "R056",
  name: "Text-to-HTML ratio is below 10%",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "A very low text ratio means the page is mostly markup, scripts, or hidden content with little actual copy. Often a sign of bloated templates or empty pages.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const r = page.text_to_html_ratio;
    if (r === null) return null;
    if (r >= 0.1) return null;
    return {
      rule_id: "R056",
      rule_name: "Text-to-HTML ratio is below 10%",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: `${(r * 100).toFixed(1)}% text-to-HTML`,
      expected_value: "At least 10–25% of the rendered HTML should be visible text content.",
      evidence: { text_to_html_ratio: r },
    };
  },
};
