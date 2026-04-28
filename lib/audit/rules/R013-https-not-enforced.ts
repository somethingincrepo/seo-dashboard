import type { SiteRule } from "./types";

export const R013_httpsNotEnforced: SiteRule = {
  id: "R013",
  name: "HTTPS is not enforced site-wide",
  severity: "critical",
  category: "technical",
  scope: "site",
  description:
    "The HTTP root should 301 to HTTPS. Sites that serve both protocols leak users into insecure sessions and confuse search engines about the canonical version.",
  check: ({ site }) => {
    if (site.https_enforced === true) return null;
    if (site.https_enforced === null) return null;
    return {
      rule_id: "R013",
      rule_name: "HTTPS is not enforced site-wide",
      severity: "critical",
      category: "technical",
      scope: "site",
      current_value: "http:// does not redirect to https://",
      expected_value: "All HTTP requests 301 redirect to the HTTPS equivalent.",
    };
  },
};
