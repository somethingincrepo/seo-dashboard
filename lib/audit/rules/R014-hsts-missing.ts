import type { SiteRule } from "./types";

export const R014_hstsMissing: SiteRule = {
  id: "R014",
  name: "HSTS header is not present",
  severity: "low",
  category: "technical",
  scope: "site",
  description:
    "Strict-Transport-Security tells browsers to only ever connect via HTTPS, preventing downgrade attacks. It is a baseline trust signal for both users and search engines.",
  check: ({ site }) => {
    if (site.hsts_header_present !== false) return null;
    return {
      rule_id: "R014",
      rule_name: "HSTS header is not present",
      severity: "low",
      category: "technical",
      scope: "site",
      current_value: "No Strict-Transport-Security response header",
      expected_value: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    };
  },
};
