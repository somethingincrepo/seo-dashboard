import type { PageRule } from "./types";

export const R031_metaDescriptionDuplicate: PageRule = {
  id: "R031",
  name: "Meta description is duplicated across pages",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Each page should have a unique description that reflects its specific content. Duplicates suggest templated boilerplate and weaken SERP differentiation.",
  check: (page, { allPages }) => {
    if (page.status_code !== 200 || !page.meta_description) return null;
    const d = page.meta_description.trim().toLowerCase();
    if (!d) return null;
    const dups = allPages.filter(
      (p) => p.id !== page.id && p.status_code === 200 && p.meta_description?.trim().toLowerCase() === d,
    );
    if (dups.length === 0) return null;
    return {
      rule_id: "R031",
      rule_name: "Meta description is duplicated across pages",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: `Description shared with ${dups.length} other page(s)`,
      expected_value: "A unique meta description per page.",
      evidence: { duplicate_urls: dups.slice(0, 10).map((p) => p.url) },
    };
  },
};
