import type { PageRule } from "./types";

export const R059_tableWithoutHeader: PageRule = {
  id: "R059",
  name: "Table is missing a header row",
  severity: "low",
  category: "content",
  scope: "page",
  description:
    "Tables without <th> elements are unreadable to screen readers and weaker signals for search engines parsing tabular data. Add a header row to every data table.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.has_table_without_header !== true) return null;
    return {
      rule_id: "R059",
      rule_name: "Table is missing a header row",
      severity: "low",
      category: "content",
      scope: "page",
      current_value: "Data table without <th> elements",
      expected_value: "Every data table has a <thead> with <th> column headers.",
    };
  },
};
