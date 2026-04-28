import type { PageRule } from "./types";

export const R049_singleInboundLink: PageRule = {
  id: "R049",
  name: "Page has only one inbound internal link",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "Pages with just one inbound link sit on the edge of the internal link graph. Adding 1-2 more contextual links surfaces the page in more journeys and lifts ranking.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.page_type === "home") return null;
    if (page.internal_links_in !== 1) return null;
    return {
      rule_id: "R049",
      rule_name: "Page has only one inbound internal link",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: "1 inbound internal link",
      expected_value: "2+ inbound internal links from contextually relevant pages.",
    };
  },
};
