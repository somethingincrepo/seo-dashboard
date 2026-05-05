import type { PageRule } from "./types";

const HOWTO_TITLE_RE = /\b(how to|how-to|step[- ]by[- ]step|tutorial|walkthrough|guide to)\b/i;

export const R068_howToSchemaNotUsed: PageRule = {
  id: "R068",
  name: "How-to article isn't tagged for rich results",
  severity: "low",
  category: "ai-geo",
  scope: "page",
  description:
    "Articles that walk a reader through numbered steps qualify for HowTo rich results in Google and get consumed verbatim by AI assistants when properly marked up.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.has_numbered_steps !== true) return null;
    const types = page.schema_types ?? [];
    if (types.includes("HowTo") || types.includes("Recipe")) return null;

    // Tighten — having ≥3 numbered headings is necessary but not sufficient.
    // Services/category pages often list "1. Service A / 2. Service B" without
    // being a how-to. Require at least one of:
    //   (a) page_type is "article", OR
    //   (b) the title or H1 contains an explicit how-to keyword.
    const titleH1 = `${page.title ?? ""} ${page.h1_text ?? ""}`;
    const titleHasHowTo = HOWTO_TITLE_RE.test(titleH1);
    const isArticle = page.page_type === "article";
    if (!titleHasHowTo && !isArticle) return null;

    return {
      rule_id: "R068",
      rule_name: "How-to article isn't tagged for rich results",
      severity: "low",
      category: "ai-geo",
      scope: "page",
      current_value: "Numbered procedural steps detected but no HowTo schema",
      expected_value: "Wrap the steps in JSON-LD HowTo schema (or Recipe for cooking content).",
    };
  },
};
