import type { PageRule } from "./types";

export const R052_brokenExternalLinks: PageRule = {
  id: "R052",
  name: "Page contains broken external links",
  severity: "medium",
  category: "content",
  scope: "page",
  description:
    "Outbound links to dead pages erode user trust and signal stale content. Either remove them, replace them with current sources, or update to archived versions.",
  check: (page) => {
    if (page.status_code !== 200) return null;
    const broken = (page.broken_links_out ?? []).filter((l) => {
      try {
        return new URL(l.url).hostname !== new URL(page.url).hostname;
      } catch { return false; }
    });
    if (broken.length === 0) return null;
    return {
      rule_id: "R052",
      rule_name: "Page contains broken external links",
      severity: "medium",
      category: "content",
      scope: "page",
      current_value: `${broken.length} broken external link(s)`,
      expected_value: "All outbound links resolve to HTTP 200.",
      evidence: { broken_links: broken.slice(0, 10) },
    };
  },
};
