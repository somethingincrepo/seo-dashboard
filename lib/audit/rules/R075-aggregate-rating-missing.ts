import type { PageRule } from "./types";

export const R075_aggregateRatingMissing: PageRule = {
  id: "R075",
  name: "Product schema missing AggregateRating",
  severity: "medium",
  category: "ai-geo",
  scope: "page",
  description:
    "Product pages with reviews need AggregateRating in their schema to qualify for star ratings in SERPs and AI shopping comparisons. Without it, the social proof is invisible to search.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "product") return null;
    const types = page.schema_types ?? [];
    if (!types.includes("Product")) return null;
    const blocks = page.schema_blocks ?? [];
    const hasRating = blocks.some((b) => {
      if (!b || typeof b !== "object") return false;
      const obj = b as Record<string, unknown>;
      return obj["@type"] === "Product" && (obj.aggregateRating || obj.review);
    });
    if (hasRating) return null;
    return {
      rule_id: "R075",
      rule_name: "Product schema missing AggregateRating",
      severity: "medium",
      category: "ai-geo",
      scope: "page",
      current_value: "Product schema present but no aggregateRating or review field",
      expected_value: "AggregateRating with ratingValue and reviewCount, or individual Review entries.",
    };
  },
};
