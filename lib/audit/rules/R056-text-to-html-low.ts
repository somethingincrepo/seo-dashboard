import type { PageRule } from "./types";

export const R056_textToHtmlLow: PageRule = {
  id: "R056",
  name: "Page has very little visible content",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "The page renders a lot of HTML but very little actual visible text. This is usually a sign of an empty template, content hidden behind a click or accordion, or a page where copy never got written. Search engines and AI assistants need real text to understand what a page is about.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const r = page.text_to_html_ratio;
    if (r === null) return null;
    if (r >= 0.1) return null;
    return {
      rule_id: "R056",
      rule_name: "Page has very little visible content",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: `Only ${(r * 100).toFixed(1)}% of the rendered HTML is visible text`,
      expected_value: "Most pages should have at least 10–25% visible text relative to their markup.",
      evidence: { text_to_html_ratio: r },
    };
  },
};
