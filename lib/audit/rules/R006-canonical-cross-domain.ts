import type { PageRule } from "./types";

function host(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export const R006_canonicalCrossDomain: PageRule = {
  id: "R006",
  name: "Canonical points to a different domain",
  severity: "high",
  category: "technical",
  scope: "page",
  description:
    "A cross-domain canonical tells search engines this page is a duplicate of a different site. This is rarely intentional and effectively de-indexes the page.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    if (!page.canonical_url) return null;
    const a = host(page.url);
    const b = host(page.canonical_url);
    if (!a || !b || a === b) return null;
    return {
      rule_id: "R006",
      rule_name: "Canonical points to a different domain",
      severity: "high",
      category: "technical",
      scope: "page",
      current_value: `Canonical points to ${b} from ${a}`,
      expected_value: "Canonical hostname matches the page hostname.",
      evidence: { page_host: a, canonical_host: b },
    };
  },
};
