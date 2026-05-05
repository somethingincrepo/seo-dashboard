import type { PageRule } from "./types";

const FAQ_TITLE_RE = /\b(faq|frequently asked|q\s*&\s*a|q&a|questions and answers)\b/i;

export const R067_faqSchemaNotUsed: PageRule = {
  id: "R067",
  name: "Q&A page isn't tagged for rich results",
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

    // Tighten — having Q-style headings isn't enough. A blog post that ends
    // with one "Common questions" section shouldn't be tagged FAQPage. Require
    // at least one of:
    //   (a) the URL slug contains "faq" / "questions",
    //   (b) the title/H1 calls itself an FAQ,
    //   (c) the page has 4+ question-style headings (real FAQ density).
    const titleH1 = `${page.title ?? ""} ${page.h1_text ?? ""}`;
    const url = page.url ?? "";
    const slugSays = /\/(faq|faqs|questions|q-and-a)\b/i.test(url);
    const titleSays = FAQ_TITLE_RE.test(titleH1);
    const headings = page.headings ?? [];
    const qHeadings = headings.filter((h) => /\?$/.test(h.text)).length;
    const dense = qHeadings >= 4;
    if (!slugSays && !titleSays && !dense) return null;

    return {
      rule_id: "R067",
      rule_name: "Q&A page isn't tagged for rich results",
      severity: "medium",
      category: "ai-geo",
      scope: "page",
      current_value: "Q-style headings detected but no FAQPage schema present",
      expected_value: "Wrap the questions and answers in JSON-LD FAQPage schema.",
      evidence: { schema_types: types, question_heading_count: qHeadings },
    };
  },
};
