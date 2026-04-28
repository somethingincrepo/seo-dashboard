import type { PageRule } from "./types";

export const R045_wordCountThin: PageRule = {
  id: "R045",
  name: "Page has fewer than 300 words of content",
  severity: "medium",
  category: "content",
  scope: "page",
  description:
    "Pages under 300 words rarely have enough depth to rank. Either expand the content or noindex the page if it's a navigational stub.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.is_indexable === false) return null;
    if (page.page_type === "home" || page.page_type === "category") return null;
    const wc = page.word_count ?? 0;
    if (wc === 0) return null;
    if (wc >= 300 || wc < 100) return null;
    return {
      rule_id: "R045",
      rule_name: "Page has fewer than 300 words of content",
      severity: "medium",
      category: "content",
      scope: "page",
      current_value: `${wc} words`,
      expected_value: "300+ words for ranking pages.",
      evidence: { word_count: wc },
    };
  },
};
