import type { PageRule } from "./types";

export const R003_mixedContent: PageRule = {
  id: "R003",
  name: "HTTPS page loads HTTP resources",
  severity: "high",
  category: "technical",
  scope: "page",
  description:
    "Mixed content triggers browser warnings, breaks SSL trust signals, and can prevent resources from loading at all in modern browsers.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (!page.is_https) return null;
    const count = page.mixed_content_count ?? 0;
    if (count === 0) return null;
    return {
      rule_id: "R003",
      rule_name: "HTTPS page loads HTTP resources",
      severity: "high",
      category: "technical",
      scope: "page",
      current_value: `${count} HTTP resource(s) on an HTTPS page`,
      expected_value: "All resources (img, script, link, iframe) loaded over HTTPS.",
      evidence: { mixed_content_count: count },
    };
  },
};
