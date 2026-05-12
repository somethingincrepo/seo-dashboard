export type PackageTier = "starter" | "growth" | "authority";

export type PackageDeliverables = {
  articles_standard: number;   // per month
  articles_longform: number;   // per month
  faq_sections: number;        // per month
  // Page-level optimization of existing pages (rewrites, header restructuring,
  // keyword coverage, metadata, internal-link insertions). Selection is
  // priority-ordered by nav importance + traffic + age + thinness. Replaces
  // the former separate `pages_optimized` deliverable.
  content_refreshes: number;   // per month
  // Net-new page gap suggestions (industry, location, service, use-case, job-title).
  // Each approved suggestion triggers full page content generation.
  page_creation_suggestions: number;  // per month (mirrors content_refreshes quota)
  internal_links: number;      // per month
  reddit_comments: number;     // reddit threads found per month
};

export const PACKAGES: Record<PackageTier, PackageDeliverables> = {
  starter: {
    articles_standard: 8,
    articles_longform: 0,
    faq_sections: 1,
    content_refreshes: 2,
    page_creation_suggestions: 2,
    internal_links: 4,
    reddit_comments: 10,
  },
  growth: {
    articles_standard: 14,
    articles_longform: 2,
    faq_sections: 3,
    content_refreshes: 6,
    page_creation_suggestions: 6,
    internal_links: 10,
    reddit_comments: 20,
  },
  authority: {
    articles_standard: 26,
    articles_longform: 4,
    faq_sections: 6,
    content_refreshes: 12,
    page_creation_suggestions: 12,
    internal_links: 20,
    reddit_comments: 40,
  },
};

export const PACKAGE_LABELS: Record<PackageTier, string> = {
  starter: "Starter",
  growth: "Growth",
  authority: "Authority",
};

// Month 1 uses the same content volumes as the ongoing package.
// The only Month 1 distinction is that implementation scope is nav pages only.

// Title generation settings per package (drives title_generation + content_scheduler)
export const TITLE_BOTTLENECK: Record<PackageTier, number> = {
  starter: 6,    // ~8 articles/mo → buffer of 6 pending before pausing
  growth: 10,    // ~16 articles/mo → buffer of 10
  authority: 16, // ~30 articles/mo → buffer of 16
};

export const TITLES_PER_RUN: Record<PackageTier, number> = {
  starter: 2,
  growth: 3,
  authority: 4,
};

// Audit scope tiers (set by audit_inventory after crawl)
export type AuditScopeTier = "full" | "priority" | "top_traffic";

export function getAuditScopeTier(pageCount: number): AuditScopeTier {
  if (pageCount <= 20) return "full";
  if (pageCount <= 50) return "priority";
  return "top_traffic";
}

// ─── Weekly cadence ────────────────────────────────────────────────────
//
// Clients see deliverables shipped on a weekly rhythm. Months are split into
// 4 weeks; we floor every weekly slot count and carry the remainder into the
// final week so the month total stays equal to PACKAGES[tier]. The agents
// pull from "this week's slots" instead of a monthly bucket.

export type WeeklyVolumes = {
  articles_standard: number[]; // length 4 — values per week (week 1, 2, 3, 4)
  articles_longform: number[];
  faq_sections: number[];
  content_refreshes: number[];
  page_creation_suggestions: number[];
  internal_links: number[];
  reddit_comments: number[];
};

/**
 * Splits each monthly volume into 4 weekly buckets. Distribution rule:
 *   base = floor(monthly / 4); remainder = monthly mod 4
 * The remainder is added to the LATER weeks (so a 14/mo splits 3/3/4/4).
 * This keeps weeks roughly even but back-loads any leftover so the first
 * week of the month doesn't overshoot before we know if a client is paused.
 */
export function splitMonthlyToWeekly(monthly: number): number[] {
  const base = Math.floor(monthly / 4);
  const remainder = monthly % 4; // 0..3
  // Distribute remainder to later weeks: e.g. r=3 → [0,1,1,1]; r=2 → [0,0,1,1]
  return [0, 1, 2, 3].map((wIdx) => base + (wIdx >= 4 - remainder ? 1 : 0));
}

export function getWeeklyVolumes(tier: PackageTier): WeeklyVolumes {
  const m = PACKAGES[tier];
  return {
    articles_standard: splitMonthlyToWeekly(m.articles_standard),
    articles_longform: splitMonthlyToWeekly(m.articles_longform),
    faq_sections: splitMonthlyToWeekly(m.faq_sections),
    content_refreshes: splitMonthlyToWeekly(m.content_refreshes),
    page_creation_suggestions: splitMonthlyToWeekly(m.page_creation_suggestions),
    internal_links: splitMonthlyToWeekly(m.internal_links),
    reddit_comments: splitMonthlyToWeekly(m.reddit_comments),
  };
}

/** ISO week-of-month: 1..4 inclusive (capped at 4 to match the 4-bucket model). */
export function weekOfMonth(date = new Date()): 1 | 2 | 3 | 4 {
  const day = date.getUTCDate();
  const idx = Math.min(4, Math.max(1, Math.ceil(day / 7))) as 1 | 2 | 3 | 4;
  return idx;
}

/** ISO Monday for the week containing the given date, as YYYY-MM-DD (UTC). */
export function isoMondayUTC(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the deliverable counts targeted for the current ISO week, given a
 * client's package tier. Each value is `targets_for_this_week`. Use alongside
 * a "delivered this week" count for progress UI.
 */
export interface WeeklyTargets {
  week_of_month: 1 | 2 | 3 | 4;
  week_start: string; // ISO Monday
  articles: number;     // articles_standard + articles_longform combined
  faq_sections: number;
  content_refreshes: number;
  page_creation_suggestions: number;
  internal_links: number;
  reddit_comments: number;
}

export function getWeeklyTargets(tier: PackageTier, date = new Date()): WeeklyTargets {
  const week = weekOfMonth(date);
  const idx = week - 1;
  const w = getWeeklyVolumes(tier);
  return {
    week_of_month: week,
    week_start: isoMondayUTC(date),
    articles: w.articles_standard[idx] + w.articles_longform[idx],
    faq_sections: w.faq_sections[idx],
    content_refreshes: w.content_refreshes[idx],
    page_creation_suggestions: w.page_creation_suggestions[idx],
    internal_links: w.internal_links[idx],
    reddit_comments: w.reddit_comments[idx],
  };
}
