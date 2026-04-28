import type { PageRule } from "./types";

const FIVE_MB = 5 * 1024 * 1024;

export const R017_renderedHtmlOversized: PageRule = {
  id: "R017",
  name: "Rendered HTML exceeds 5 MB",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "Very large HTML payloads slow rendering, increase memory pressure on mobile, and often indicate inlined data or runaway template loops that should be paginated.",
  check: (page) => {
    const size = page.rendered_html_size;
    if (size === null || size <= FIVE_MB) return null;
    return {
      rule_id: "R017",
      rule_name: "Rendered HTML exceeds 5 MB",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: `${(size / 1024 / 1024).toFixed(1)} MB rendered HTML`,
      expected_value: "Under 5 MB; ideally under 1 MB.",
      evidence: { rendered_html_size: size },
    };
  },
};
