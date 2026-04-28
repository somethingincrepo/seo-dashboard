import type { SiteRule } from "./types";

export const R064_llmsFullTxtMissing: SiteRule = {
  id: "R064",
  name: "/llms-full.txt is missing",
  severity: "low",
  category: "ai-geo",
  scope: "site",
  description:
    "llms-full.txt is the long-form companion to llms.txt — a single document with the full text of every key page. It dramatically improves how accurately AI assistants can answer questions about the site.",
  check: ({ site }) => {
    if (site.llms_full_txt_present === true) return null;
    return {
      rule_id: "R064",
      rule_name: "/llms-full.txt is missing",
      severity: "low",
      category: "ai-geo",
      scope: "site",
      current_value: "/llms-full.txt returns 404",
      expected_value: "An llms-full.txt at the site root with the full text of every important page.",
    };
  },
};
