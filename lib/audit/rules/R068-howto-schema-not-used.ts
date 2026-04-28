import type { PageRule } from "./types";

export const R068_howToSchemaNotUsed: PageRule = {
  id: "R068",
  name: "Numbered-step content not marked up with HowTo schema",
  severity: "low",
  category: "ai-geo",
  scope: "page",
  description:
    "Pages presenting numbered procedural steps qualify for HowTo rich results and are consumed verbatim by AI assistants when properly marked up.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.has_numbered_steps !== true) return null;
    const types = page.schema_types ?? [];
    if (types.includes("HowTo") || types.includes("Recipe")) return null;
    return {
      rule_id: "R068",
      rule_name: "Numbered-step content not marked up with HowTo schema",
      severity: "low",
      category: "ai-geo",
      scope: "page",
      current_value: "Numbered procedural steps detected but no HowTo schema",
      expected_value: "Wrap the steps in JSON-LD HowTo schema (or Recipe for cooking content).",
    };
  },
};
