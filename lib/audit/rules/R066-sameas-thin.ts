import type { PageRule } from "./types";

export const R066_sameAsThin: PageRule = {
  id: "R066",
  name: "Organization schema has fewer than 2 sameAs entries",
  severity: "low",
  category: "ai-geo",
  scope: "page",
  description:
    "sameAs URLs (LinkedIn, Twitter/X, Wikipedia, Crunchbase, etc.) help search engines and AI assistants link your Organization entity to the broader knowledge graph.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.page_type !== "home") return null;
    if (!(page.schema_types ?? []).some((t) => t === "Organization" || t === "LocalBusiness")) return null;
    const blocks = page.schema_blocks ?? [];
    let sameAsCount = 0;
    for (const b of blocks) {
      if (!b || typeof b !== "object") continue;
      const sa = (b as Record<string, unknown>).sameAs;
      if (Array.isArray(sa)) sameAsCount = Math.max(sameAsCount, sa.length);
      else if (typeof sa === "string") sameAsCount = Math.max(sameAsCount, 1);
    }
    if (sameAsCount >= 2) return null;
    return {
      rule_id: "R066",
      rule_name: "Organization schema has fewer than 2 sameAs entries",
      severity: "low",
      category: "ai-geo",
      scope: "page",
      current_value: `${sameAsCount} sameAs entr${sameAsCount === 1 ? "y" : "ies"}`,
      expected_value: "At least 2 sameAs URLs (LinkedIn, Twitter/X, Wikipedia, etc.).",
      evidence: { sameAs_count: sameAsCount },
    };
  },
};
