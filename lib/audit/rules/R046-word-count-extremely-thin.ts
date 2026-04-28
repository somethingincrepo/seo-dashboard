import type { PageRule } from "./types";

export const R046_wordCountExtremelyThin: PageRule = {
  id: "R046",
  name: "Page has fewer than 100 words of content",
  severity: "high",
  category: "content",
  scope: "page",
  description:
    "Pages under 100 words are typically empty templates, error pages mis-categorized as 200, or stub pages that should be merged or removed.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.is_indexable === false) return null;
    if (page.page_type === "home") return null;
    const wc = page.word_count ?? 0;
    if (wc === 0 || wc >= 100) return null;
    return {
      rule_id: "R046",
      rule_name: "Page has fewer than 100 words of content",
      severity: "high",
      category: "content",
      scope: "page",
      current_value: `${wc} words`,
      expected_value: "300+ words; under 100 usually indicates an empty template or stub.",
      evidence: { word_count: wc },
    };
  },
};
