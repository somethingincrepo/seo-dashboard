import type { PageRule } from "./types";

export const R001_pageNonOkStatus: PageRule = {
  id: "R001",
  name: "Page returns non-OK status",
  severity: "critical",
  category: "technical",
  scope: "page",
  description:
    "Crawled pages returning 4xx or 5xx status codes are dead ends for users and search engines. Either remove links to them, redirect them, or restore the page.",
  check: (page) => {
    const code = page.status_code;
    if (code === null || code === 200 || (code >= 300 && code < 400)) return null;
    return {
      rule_id: "R001",
      rule_name: "Page returns non-OK status",
      severity: "critical",
      category: "technical",
      scope: "page",
      current_value: `HTTP ${code}`,
      expected_value: "HTTP 200 (or a 301 redirect to a live page).",
      evidence: { status_code: code },
    };
  },
};
