import type { PageRule } from "./types";

export const R029_metaDescriptionTooLong: PageRule = {
  id: "R029",
  name: "Meta description exceeds 160 characters",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "Search engines truncate descriptions around 160 characters on desktop and ~120 on mobile. Anything longer is cut off mid-sentence in the SERP.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const len = page.meta_description_length ?? 0;
    if (len <= 160) return null;
    return {
      rule_id: "R029",
      rule_name: "Meta description exceeds 160 characters",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: `${len} characters`,
      expected_value: "70–160 characters.",
      evidence: { meta_description_length: len },
    };
  },
};
