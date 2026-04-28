import type { PageRule } from "./types";

export const R053_genericAnchorExcessive: PageRule = {
  id: "R053",
  name: "Page uses generic anchor text excessively",
  severity: "medium",
  category: "content",
  scope: "page",
  description:
    "Anchor text like \"click here\" and \"read more\" tells search engines and screen reader users nothing about the destination. Use descriptive anchors that name what's on the linked page.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const generic = page.generic_anchor_count ?? 0;
    if (generic < 3) return null;
    return {
      rule_id: "R053",
      rule_name: "Page uses generic anchor text excessively",
      severity: "medium",
      category: "content",
      scope: "page",
      current_value: `${generic} generic anchors ("click here", "read more", etc.)`,
      expected_value: "Anchor text that names the destination topic or page.",
      evidence: { generic_anchor_count: generic },
    };
  },
};
