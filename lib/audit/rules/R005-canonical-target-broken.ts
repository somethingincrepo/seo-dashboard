import type { PageRule } from "./types";

export const R005_canonicalTargetBroken: PageRule = {
  id: "R005",
  name: "Canonical points to a non-200 URL",
  severity: "high",
  category: "technical",
  scope: "page",
  description:
    "A canonical pointing to a 404 or redirect tells search engines to index a page that does not exist or move on. The canonical target must return 200.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (!page.canonical_url) return null;
    const tgt = page.canonical_status_code;
    if (tgt === null || tgt === 200) return null;
    return {
      rule_id: "R005",
      rule_name: "Canonical points to a non-200 URL",
      severity: "high",
      category: "technical",
      scope: "page",
      current_value: `Canonical → ${page.canonical_url} (HTTP ${tgt})`,
      expected_value: "Canonical target returns HTTP 200.",
      evidence: { canonical_url: page.canonical_url, target_status: tgt },
    };
  },
};
