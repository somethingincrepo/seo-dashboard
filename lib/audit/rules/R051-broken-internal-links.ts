import type { PageRule } from "./types";

export const R051_brokenInternalLinks: PageRule = {
  id: "R051",
  name: "Page contains broken internal links",
  severity: "high",
  category: "content",
  scope: "page",
  description:
    "Broken internal links (404s) waste link equity, frustrate users, and signal a poorly maintained site. Every internal link should resolve to a live page.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const broken = (page.broken_links_out ?? []).filter((l) => {
      // internal = same host
      try {
        return new URL(l.url).hostname === new URL(page.url).hostname;
      } catch { return false; }
    });
    if (broken.length === 0) return null;
    return {
      rule_id: "R051",
      rule_name: "Page contains broken internal links",
      severity: "high",
      category: "content",
      scope: "page",
      current_value: `${broken.length} broken internal link(s)`,
      expected_value: "All internal links resolve to HTTP 200.",
      evidence: { broken_links: broken.slice(0, 10) },
    };
  },
};
