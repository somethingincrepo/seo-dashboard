import type { PageRule } from "./types";

export const R038_twitterCardMissing: PageRule = {
  id: "R038",
  name: "Twitter card meta is missing",
  severity: "low",
  category: "on-page",
  scope: "page",
  description:
    "Without twitter:card, Twitter/X falls back to a plain text preview. Setting `summary_large_image` gives the page a richer card when shared.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.twitter_card && page.twitter_card.trim().length > 0) return null;
    return {
      rule_id: "R038",
      rule_name: "Twitter card meta is missing",
      severity: "low",
      category: "on-page",
      scope: "page",
      current_value: "(no twitter:card)",
      expected_value: "<meta name=\"twitter:card\" content=\"summary_large_image\">",
    };
  },
};
