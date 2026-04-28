import type { PageRule } from "./types";

export const R061_articleNoImages: PageRule = {
  id: "R061",
  name: "Long-form article has no images",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "Long articles with no images become walls of text — readers bounce, dwell time drops, and the page loses opportunities to rank in image search.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.page_type !== "article") return null;
    const wc = page.word_count ?? 0;
    if (wc < 800) return null;
    if ((page.images_count ?? 0) > 0) return null;
    return {
      rule_id: "R061",
      rule_name: "Long-form article has no images",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: `${wc}-word article with 0 images`,
      expected_value: "Long-form articles include at least one supporting image.",
      evidence: { word_count: wc },
    };
  },
};
