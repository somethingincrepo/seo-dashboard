import type { PageRule } from "./types";

export const R072_localBusinessSchemaMissing: PageRule = {
  id: "R072",
  name: "Homepage with address but no LocalBusiness schema",
  severity: "medium",
  category: "ai-geo",
  scope: "page",
  description:
    "When a site advertises a physical address, LocalBusiness schema unlocks Google Business Profile linking, map pack visibility, and AI assistant geographic queries.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "home") return null;
    // Heuristic deterministic check: PostalAddress in any schema block but no LocalBusiness type.
    const blocks = page.schema_blocks ?? [];
    let hasAddress = false;
    for (const b of blocks) {
      if (!b || typeof b !== "object") continue;
      const obj = b as Record<string, unknown>;
      if (obj.address && typeof obj.address === "object") hasAddress = true;
    }
    if (!hasAddress) return null;
    const types = page.schema_types ?? [];
    if (types.includes("LocalBusiness")) return null;
    return {
      rule_id: "R072",
      rule_name: "Homepage with address but no LocalBusiness schema",
      severity: "medium",
      category: "ai-geo",
      scope: "page",
      current_value: "PostalAddress present in schema but no LocalBusiness @type",
      expected_value: "LocalBusiness JSON-LD with name, address, telephone, openingHours, and geo coordinates.",
    };
  },
};
