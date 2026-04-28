import type { PageRule } from "./types";

const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

export const R073_articleStale: PageRule = {
  id: "R073",
  name: "Article older than 18 months without an updated date",
  severity: "low",
  category: "ai-geo",
  scope: "page",
  description:
    "AI assistants and search engines weight content freshness heavily. Old articles without an updated marker are deprioritized, especially for time-sensitive topics.",
  check: (page) => {
    if (page.status_code !== 200 || page.page_type !== "article") return null;
    if (!page.date_published) return null;
    const published = Date.parse(page.date_published);
    if (Number.isNaN(published)) return null;
    const ageMs = Date.now() - published;
    if (ageMs < EIGHTEEN_MONTHS_MS) return null;
    if (page.date_modified) {
      const modified = Date.parse(page.date_modified);
      if (!Number.isNaN(modified) && Date.now() - modified < EIGHTEEN_MONTHS_MS) return null;
    }
    return {
      rule_id: "R073",
      rule_name: "Article older than 18 months without an updated date",
      severity: "low",
      category: "ai-geo",
      scope: "page",
      current_value: `Published ${new Date(published).toISOString().slice(0, 10)} with no recent dateModified`,
      expected_value: "Stale articles refreshed and given a current dateModified, or noindexed.",
      evidence: { date_published: page.date_published, date_modified: page.date_modified },
    };
  },
};
