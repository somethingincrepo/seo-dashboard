import type { PageRule } from "./types";

export const R055_duplicateContent: PageRule = {
  id: "R055",
  name: "Page is an exact duplicate of another page",
  severity: "high",
  category: "content",
  scope: "page",
  description:
    "Two indexable pages with identical content compete for the same query and split ranking. Pick one as canonical and either redirect or noindex the other.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (!page.duplicate_of_url) return null;
    return {
      rule_id: "R055",
      rule_name: "Page is an exact duplicate of another page",
      severity: "high",
      category: "content",
      scope: "page",
      current_value: `Identical content to ${page.duplicate_of_url}`,
      expected_value: "Each indexable URL has unique content, or canonicalizes/redirects to the original.",
      evidence: { duplicate_of_url: page.duplicate_of_url, content_hash: page.content_hash },
    };
  },
};
