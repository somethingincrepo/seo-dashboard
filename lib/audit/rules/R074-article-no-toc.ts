import type { PageRule } from "./types";

export const R074_articleNoToc: PageRule = {
  id: "R074",
  name: "Long-form article has no table of contents",
  severity: "low",
  category: "ai-geo",
  scope: "page",
  description:
    "Articles over 2000 words without a TOC are harder to scan and harder for AI assistants to navigate to a specific section. A jump-link TOC also enables jump-link rich results.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "article") return null;
    const wc = page.word_count ?? 0;
    if (wc < 2000) return null;
    if (page.has_table_of_contents === true) return null;
    return {
      rule_id: "R074",
      rule_name: "Long-form article has no table of contents",
      severity: "low",
      category: "ai-geo",
      scope: "page",
      current_value: `${wc}-word article with no TOC`,
      expected_value: "A jump-link table of contents anchored to section headings.",
      evidence: { word_count: wc },
    };
  },
};
