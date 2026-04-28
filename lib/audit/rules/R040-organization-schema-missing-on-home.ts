import type { PageRule } from "./types";

export const R040_organizationSchemaMissingOnHome: PageRule = {
  id: "R040",
  name: "Organization schema missing on homepage",
  severity: "medium",
  category: "on-page",
  scope: "page",
  description:
    "Organization schema on the homepage tells search engines (and AI assistants) the site's name, logo, and key identity links. It's the foundational entity declaration for the brand.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.page_type !== "home") return null;
    const types = page.schema_types ?? [];
    if (types.includes("Organization") || types.includes("LocalBusiness")) return null;
    return {
      rule_id: "R040",
      rule_name: "Organization schema missing on homepage",
      severity: "medium",
      category: "on-page",
      scope: "page",
      current_value: types.length > 0 ? `Schema types found: ${types.join(", ")}` : "(no schema markup)",
      expected_value: "JSON-LD with @type Organization (or LocalBusiness for storefronts).",
    };
  },
};
