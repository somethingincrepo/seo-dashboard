import type { PageRule } from "./types";

export const R019_skippedHeadingLevel: PageRule = {
  id: "R019",
  name: "Heading levels are skipped",
  severity: "low",
  category: "technical",
  scope: "page",
  description:
    "Heading hierarchy should descend without gaps (H1 → H2 → H3). Skipping levels (e.g. H1 → H3) breaks accessibility tooling and weakens the document outline.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.has_skipped_heading_level !== true) return null;
    return {
      rule_id: "R019",
      rule_name: "Heading levels are skipped",
      severity: "low",
      category: "technical",
      scope: "page",
      current_value: "Heading sequence skips one or more levels",
      expected_value: "Heading levels descend in order (H1 → H2 → H3, no gaps).",
      evidence: { headings: page.headings ?? [] },
    };
  },
};
