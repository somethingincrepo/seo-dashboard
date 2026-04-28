import type { PageRule } from "./types";

export const R060_singleItemList: PageRule = {
  id: "R060",
  name: "List element contains only one item",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "A <ul> or <ol> with a single <li> is almost always a templating leftover. Either expand the list or convert it to a paragraph.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.has_single_item_list !== true) return null;
    return {
      rule_id: "R060",
      rule_name: "List element contains only one item",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: "<ul>/<ol> with one <li>",
      expected_value: "Lists contain 2+ items, or use a paragraph instead.",
    };
  },
};
