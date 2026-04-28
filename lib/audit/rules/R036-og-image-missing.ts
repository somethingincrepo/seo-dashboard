import type { PageRule } from "./types";

export const R036_ogImageMissing: PageRule = {
  id: "R036",
  name: "Open Graph image is missing",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Pages without og:image render as plain text links when shared on social networks and chat apps. Click-through drops dramatically without a visual.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.og_image && page.og_image.trim().length > 0) return null;
    return {
      rule_id: "R036",
      rule_name: "Open Graph image is missing",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: "(no og:image)",
      expected_value: "<meta property=\"og:image\"> pointing to an absolute URL of a 1200×630 image.",
    };
  },
};
