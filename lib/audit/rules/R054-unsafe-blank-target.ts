import type { PageRule } from "./types";

export const R054_unsafeBlankTarget: PageRule = {
  id: "R054",
  name: "target=\"_blank\" links missing rel=\"noopener\"",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "Without rel=\"noopener\", a target=\"_blank\" link gives the destination page partial control of the opener via window.opener, a known phishing and tab-hijacking vector.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const n = page.unsafe_blank_target_count ?? 0;
    if (n === 0) return null;
    return {
      rule_id: "R054",
      rule_name: "target=\"_blank\" links missing rel=\"noopener\"",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: `${n} link(s) with target=\"_blank\" but no rel=\"noopener\"`,
      expected_value: "Add rel=\"noopener noreferrer\" to every target=\"_blank\" link.",
      evidence: { count: n },
    };
  },
};
