import type { PageRule } from "./types";

export const R069_authorSchemaMissingOnArticle: PageRule = {
  id: "R069",
  name: "Article schema missing author",
  severity: "medium",
  category: "ai-geo",
  scope: "page",
  description:
    "E-E-A-T (Experience, Expertise, Authority, Trust) is one of the strongest content quality signals. Articles without an explicit author schema score worse on every E-E-A-T dimension.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "article") return null;
    const types = page.schema_types ?? [];
    if (!types.includes("Article") && !types.includes("BlogPosting") && !types.includes("NewsArticle")) return null;
    const blocks = page.schema_blocks ?? [];
    const hasAuthor = blocks.some((b) => {
      if (!b || typeof b !== "object") return false;
      const t = (b as Record<string, unknown>)["@type"];
      const isArticleType = t === "Article" || t === "BlogPosting" || t === "NewsArticle";
      return isArticleType && (b as Record<string, unknown>).author;
    });
    if (hasAuthor) return null;
    return {
      rule_id: "R069",
      rule_name: "Article schema missing author",
      severity: "medium",
      category: "ai-geo",
      scope: "page",
      current_value: "Article schema present but no author field",
      expected_value: "Article schema includes an author with @type Person and a name.",
    };
  },
};
