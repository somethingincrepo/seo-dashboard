export type PackageTier = "starter" | "growth" | "authority";

export type PackageDeliverables = {
  articles_standard: number;   // per month
  articles_longform: number;   // per month
  faq_sections: number;        // per month
  content_refreshes: number;   // per month
  pages_optimized: number;     // per month (0 = refresh rotation only)
  internal_links: number;      // per month
  reddit_comments: number;     // per month
};

export const PACKAGES: Record<PackageTier, PackageDeliverables> = {
  starter: {
    articles_standard: 8,
    articles_longform: 0,
    faq_sections: 1,
    content_refreshes: 1,
    pages_optimized: 0,
    internal_links: 4,
    reddit_comments: 2,
  },
  growth: {
    articles_standard: 14,
    articles_longform: 2,
    faq_sections: 3,
    content_refreshes: 4,
    pages_optimized: 6,
    internal_links: 10,
    reddit_comments: 5,
  },
  authority: {
    articles_standard: 26,
    articles_longform: 4,
    faq_sections: 6,
    content_refreshes: 8,
    pages_optimized: 12,
    internal_links: 20,
    reddit_comments: 10,
  },
};

export const PACKAGE_LABELS: Record<PackageTier, string> = {
  starter: "Starter",
  growth: "Growth",
  authority: "Authority",
};

// Month 1 uses the same content volumes as the ongoing package.
// The only Month 1 distinction is that implementation scope is nav pages only.

// Title generation settings per package (drives SOP 15 + content_scheduler)
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
