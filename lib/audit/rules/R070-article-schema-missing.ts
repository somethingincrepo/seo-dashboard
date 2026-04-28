import type { PageRule } from "./types";

export const R070_articleSchemaMissing: PageRule = {
  id: "R070",
  name: "Article page missing Article schema",
  severity: "medium",
  category: "ai-geo",
  scope: "page",
  description:
    "Article schema is required for rich-result eligibility (top stories, AI overview citation) and gives search engines explicit signals for byline, date, and topic.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "article") return null;
    const types = page.schema_types ?? [];
    if (types.some((t) => t === "Article" || t === "BlogPosting" || t === "NewsArticle")) return null;
    return {
      rule_id: "R070",
      rule_name: "Article page missing Article schema",
      severity: "medium",
      category: "ai-geo",
      scope: "page",
      current_value: types.length > 0 ? `Schema types: ${types.join(", ")}` : "(no schema markup)",
      expected_value: "Article (or BlogPosting/NewsArticle) JSON-LD with headline, author, datePublished, and image.",
    };
  },
};
