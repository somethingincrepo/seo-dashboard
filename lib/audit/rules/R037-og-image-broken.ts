import type { PageRule } from "./types";

export const R037_ogImageBroken: PageRule = {
  id: "R037",
  name: "Open Graph image returns non-200",
  severity: "high",
  category: "on-page",
  scope: "page",
  description:
    "An og:image that 404s renders as a broken image (or no image) when the page is shared on social or chat. Users see the link as low quality and skip it.",
  check: (page) => {
    if (page.status_code !== 200 || !page.og_image) return null;
    const s = page.og_image_status;
    if (s === null || s === 200) return null;
    return {
      rule_id: "R037",
      rule_name: "Open Graph image returns non-200",
      severity: "high",
      category: "on-page",
      scope: "page",
      current_value: `og:image returns HTTP ${s}: ${page.og_image}`,
      expected_value: "og:image URL returns HTTP 200.",
      evidence: { og_image: page.og_image, status: s },
    };
  },
};
