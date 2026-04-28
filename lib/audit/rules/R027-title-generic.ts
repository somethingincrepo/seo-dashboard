import type { PageRule } from "./types";

const GENERIC_TITLES = new Set([
  "home", "homepage", "welcome", "welcome!", "page", "untitled", "default", "index",
  "new page", "site", "website", "main", "blog", "article",
]);

export const R027_titleGeneric: PageRule = {
  id: "R027",
  name: "Title is generic boilerplate",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Titles like \"Home\", \"Welcome\", or \"Untitled\" carry no information for users or search engines. Even the homepage should describe what the site does.",
  check: (page) => {
    if (page.status_code !== 200 || !page.title) return null;
    const t = page.title.trim().toLowerCase();
    if (!GENERIC_TITLES.has(t)) return null;
    return {
      rule_id: "R027",
      rule_name: "Title is generic boilerplate",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: `"${page.title}"`,
      expected_value: "A descriptive title that names the page's primary topic plus a brand modifier.",
    };
  },
};
