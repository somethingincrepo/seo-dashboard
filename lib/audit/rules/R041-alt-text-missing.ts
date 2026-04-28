import type { PageRule } from "./types";

export const R041_altTextMissing: PageRule = {
  id: "R041",
  name: "Images missing alt text",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Images without alt attributes are invisible to screen readers and image search. Alt text is also a strong topical signal for the page itself.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const missing = page.alt_text_missing_count ?? 0;
    if (missing === 0) return null;
    return {
      rule_id: "R041",
      rule_name: "Images missing alt text",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: `${missing} image(s) without an alt attribute`,
      expected_value: "Every <img> has an alt attribute (alt=\"\" only for purely decorative images).",
      evidence: { missing_count: missing, total_images: page.images_count ?? 0 },
    };
  },
};
