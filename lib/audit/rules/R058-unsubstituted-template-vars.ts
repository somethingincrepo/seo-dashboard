import type { PageRule } from "./types";

export const R058_unsubstitutedTemplateVars: PageRule = {
  id: "R058",
  name: "Page contains unsubstituted template variables",
  severity: "critical",
  category: "content",
  scope: "page",
  description:
    "Visible patterns like {{ name }} or [client_name] mean a templating engine failed to render. The page is shipping broken to real users.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const found = page.unsubstituted_vars ?? [];
    if (found.length === 0) return null;
    return {
      rule_id: "R058",
      rule_name: "Page contains unsubstituted template variables",
      severity: "critical",
      category: "content",
      scope: "page",
      current_value: `Found: ${found.slice(0, 5).join(", ")}`,
      expected_value: "All template variables resolved to real content.",
      evidence: { matches: found },
    };
  },
};
