import type { PageRule } from "./types";

export const R071_productSchemaMissing: PageRule = {
  id: "R071",
  name: "Product page missing Product schema",
  severity: "high",
  category: "ai-geo",
  scope: "page",
  description:
    "Product schema is required for rich SERP cards (price, availability, ratings) and for inclusion in AI shopping answers. Product pages without it are invisible in product-specific surfaces.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "product") return null;
    const types = page.schema_types ?? [];
    if (types.includes("Product")) return null;
    return {
      rule_id: "R071",
      rule_name: "Product page missing Product schema",
      severity: "high",
      category: "ai-geo",
      scope: "page",
      current_value: types.length > 0 ? `Schema types: ${types.join(", ")}` : "(no schema markup)",
      expected_value: "Product JSON-LD including name, image, description, offers (price, availability), and aggregateRating where reviews exist.",
    };
  },
};
