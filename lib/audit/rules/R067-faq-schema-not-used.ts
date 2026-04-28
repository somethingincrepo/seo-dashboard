import type { PageRule } from "./types";

export const R067_faqSchemaNotUsed: PageRule = {
  id: "R067",
  name: "FAQ-format content not marked up with FAQPage schema",
  severity: "medium",
  category: "ai-geo",
  scope: "page",
  description:
    "Pages with question-style headings get rich-result eligibility (and AI-extraction lift) when wrapped in FAQPage schema. Q&A patterns without schema are leaving visibility on the table.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.has_faq_format !== true) return null;
    const types = page.schema_types ?? [];
    if (types.includes("FAQPage")) return null;
    return {
      rule_id: "R067",
      rule_name: "FAQ-format content not marked up with FAQPage schema",
      severity: "medium",
      category: "ai-geo",
      scope: "page",
      current_value: "Q-style headings detected but no FAQPage schema present",
      expected_value: "Wrap the questions and answers in JSON-LD FAQPage schema.",
      evidence: { schema_types: types },
    };
  },
};
