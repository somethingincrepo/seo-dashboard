import type { PageRule } from "./types";

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

export const R044_allCapsHeading: PageRule = {
  id: "R044",
  name: "Heading uses all-caps text",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "All-caps headings are read letter-by-letter by some screen readers and feel shouty. Use CSS text-transform for visual styling, not literal uppercase content.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const headings = page.headings ?? [];
    const offenders = headings.filter((h) => isAllCaps(h.text));
    if (offenders.length === 0) return null;
    return {
      rule_id: "R044",
      rule_name: "Heading uses all-caps text",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: `${offenders.length} all-caps heading(s)`,
      expected_value: "Sentence- or title-case heading text. Use CSS for visual uppercase.",
      evidence: { sample: offenders.slice(0, 5).map((h) => h.text) },
    };
  },
};
