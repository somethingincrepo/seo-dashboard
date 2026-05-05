import type { PageRule } from "./types";
import { isBotChallengePage, isPaginationPage } from "./_helpers";

export const R026_titleDuplicate: PageRule = {
  id: "R026",
  name: "Multiple pages share the same title",
  severity: "high",
  category: "on-page",
  scope: "page",
  description:
    "Each page should have a unique title that reflects its specific content. Duplicate titles signal duplicate or templated content and hurt search visibility for all variants.",
  check: (page, { allPages }) => {
    if (page.status_code !== 200 || !page.title) return null;
    if (isBotChallengePage(page)) return null; // crawler got bot-blocked; not the real title
    if (isPaginationPage(page)) return null;   // pagination pages are expected to share the listing title
    const t = page.title.trim().toLowerCase();
    if (!t) return null;
    const dups = allPages.filter(
      (p) =>
        p.id !== page.id &&
        p.status_code === 200 &&
        !!p.title &&
        !isBotChallengePage(p) &&
        !isPaginationPage(p) &&
        p.title.trim().toLowerCase() === t,
    );
    if (dups.length === 0) return null;
    return {
      rule_id: "R026",
      rule_name: "Multiple pages share the same title",
      severity: "high",
      category: "on-page",
      scope: "page",
      current_value: `Title shared with ${dups.length} other page${dups.length === 1 ? "" : "s"}`,
      expected_value: "A unique title per page.",
      evidence: { title: page.title, duplicate_urls: dups.slice(0, 10).map((p) => p.url) },
    };
  },
};
