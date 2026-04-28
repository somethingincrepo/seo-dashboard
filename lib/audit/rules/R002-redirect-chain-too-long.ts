import type { PageRule } from "./types";

export const R002_redirectChainTooLong: PageRule = {
  id: "R002",
  name: "Redirect chain has more than 2 hops",
  severity: "high",
  category: "technical",
  scope: "page",
  description:
    "Each redirect hop adds latency and dilutes link equity. Chains longer than two hops should be collapsed into a single direct 301.",
  check: (page) => {
    const chain = page.redirect_chain;
    if (!chain || chain.length <= 2) return null;
    return {
      rule_id: "R002",
      rule_name: "Redirect chain has more than 2 hops",
      severity: "high",
      category: "technical",
      scope: "page",
      current_value: `${chain.length}-hop redirect chain`,
      expected_value: "A single direct 301 to the final destination.",
      evidence: { hops: chain },
    };
  },
};
