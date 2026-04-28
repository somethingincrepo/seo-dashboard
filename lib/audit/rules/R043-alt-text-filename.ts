import type { PageRule } from "./types";

export const R043_altTextFilename: PageRule = {
  id: "R043",
  name: "Alt text matches the image filename",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Alt text like \"DSC_0421.jpg\" or \"hero-image-1.png\" carries no real meaning. Screen reader users hear gibberish and search engines learn nothing about the image.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const n = page.alt_text_filename_count ?? 0;
    if (n === 0) return null;
    return {
      rule_id: "R043",
      rule_name: "Alt text matches the image filename",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: `${n} image(s) where alt text matches the filename`,
      expected_value: "Alt text describes what's actually in the image, not the file's name.",
      evidence: { count: n },
    };
  },
};
