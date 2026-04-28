import type { PageRule } from "./types";

export const R020_hreflangInvalid: PageRule = {
  id: "R020",
  name: "Hreflang configuration is invalid",
  severity: "medium",
  category: "technical",
  scope: "page",
  description:
    "Hreflang tags require valid ISO language codes and reciprocal return tags. Invalid or one-way hreflang is ignored entirely by search engines.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.hreflang_invalid !== true) return null;
    return {
      rule_id: "R020",
      rule_name: "Hreflang configuration is invalid",
      severity: "medium",
      category: "technical",
      scope: "page",
      current_value: "Invalid language code or missing return tag",
      expected_value: "Valid ISO 639-1 language codes; every targeted variant declares a reciprocal hreflang.",
      evidence: { hreflang_tags: page.hreflang_tags ?? [] },
    };
  },
};
