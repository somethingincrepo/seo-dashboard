import type { PageRule } from "./types";

export const R026_titleDuplicate: PageRule = {
  id: "R026",
  name: "Title is duplicated across multiple pages",
  severity: "high",
  category: "on-page",
  scope: "page",
  description:
    "Each page should have a unique title that reflects its specific content. Duplicate titles signal duplicate or templated content and hurt search visibility for all variants.",
  check: (page, { allPages }) => {
    if (page.status_code !== 200 || !page.title) return null;
    const t = page.title.trim().toLowerCase();
    if (!t) return null;
    const dups = allPages.filter(
      (p) => p.id !== page.id && p.status_code === 200 && p.title?.trim().toLowerCase() === t,
    );
    if (dups.length === 0) return null;
    return {
      rule_id: "R026",
      rule_name: "Title is duplicated across multiple pages",
      severity: "high",
      category: "on-page",
      scope: "page",
      current_value: `Title shared with ${dups.length} other page(s)`,
      expected_value: "A unique title per page.",
      evidence: { title: page.title, duplicate_urls: dups.slice(0, 10).map((p) => p.url) },
    };
  },
};
