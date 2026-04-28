import type { PageRule } from "./types";

export const R030_metaDescriptionTooShort: PageRule = {
  id: "R030",
  name: "Meta description is shorter than 70 characters",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "Very short descriptions waste SERP real estate. There's almost always room to add a benefit, modifier, or call to action that improves click-through.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const len = page.meta_description_length ?? 0;
    if (len === 0) return null;
    if (len >= 70) return null;
    return {
      rule_id: "R030",
      rule_name: "Meta description is shorter than 70 characters",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: `${len} characters`,
      expected_value: "70–160 characters.",
      evidence: { meta_description_length: len },
    };
  },
};
