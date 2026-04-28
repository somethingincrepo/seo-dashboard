import type { PageRule } from "./types";

export const R048_orphanPage: PageRule = {
  id: "R048",
  name: "Orphan page (zero inbound internal links)",
  severity: "high",
  category: "content",
  scope: "page",
  description:
    "Pages with no inbound internal links can only be discovered via the sitemap. They receive almost no link equity and are typically forgotten or template artifacts.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.page_type === "home") return null;
    const inbound = page.internal_links_in;
    if (inbound === null || inbound > 0) return null;
    return {
      rule_id: "R048",
      rule_name: "Orphan page (zero inbound internal links)",
      severity: "high",
      category: "content",
      scope: "page",
      current_value: "0 inbound internal links",
      expected_value: "Linked from at least one other page on the site (ideally from a topical hub or nav).",
    };
  },
};
