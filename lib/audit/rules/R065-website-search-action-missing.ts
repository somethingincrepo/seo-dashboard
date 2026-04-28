import type { PageRule } from "./types";

function blocksContain(blocks: unknown[] | null, predicate: (b: Record<string, unknown>) => boolean): boolean {
  if (!blocks) return false;
  for (const b of blocks) {
    if (b && typeof b === "object" && predicate(b as Record<string, unknown>)) return true;
  }
  return false;
}

export const R065_websiteSearchActionMissing: PageRule = {
  id: "R065",
  name: "WebSite schema lacks SearchAction",
  severity: "low",
  category: "ai-geo",
  scope: "page",
  description:
    "A WebSite schema with potentialAction → SearchAction allows search engines and AI assistants to surface a sitelinks search box pointing at the site's own search.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (page.page_type !== "home") return null;
    const types = page.schema_types ?? [];
    if (!types.includes("WebSite")) return null;
    const hasSearch = blocksContain(page.schema_blocks, (b) => {
      const action = b.potentialAction;
      if (!action) return false;
      const list = Array.isArray(action) ? action : [action];
      return list.some((a) => a && typeof a === "object" && (a as Record<string, unknown>)["@type"] === "SearchAction");
    });
    if (hasSearch) return null;
    return {
      rule_id: "R065",
      rule_name: "WebSite schema lacks SearchAction",
      severity: "low",
      category: "ai-geo",
      scope: "page",
      current_value: "WebSite schema present but no potentialAction → SearchAction",
      expected_value: "WebSite schema with a SearchAction pointing at the site's search URL template.",
    };
  },
};
