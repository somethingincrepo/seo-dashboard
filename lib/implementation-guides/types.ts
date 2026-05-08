import type { Platform } from "../connections/types";

export type DeliverableType =
  | "title_tag"
  | "meta_description"
  | "h1"
  | "internal_link_insertion"
  | "content_rewrite"
  | "content_block_insert"
  | "full_article_publish"
  | "schema_org"
  | "faq_schema"
  | "location_signals"
  | "redirect"
  | "canonical"
  | "alt_text"
  | "robots_txt"
  | "sitemap_xml"
  | "indexation_submit";

export type GuidePlatform = Platform | "generic";

export type GuideCopyable = {
  label: string;
  // Source field on the Change record to copy. The component resolves and substitutes at render time.
  // Use "html_body" / "meta_title" / "meta_description" / "slug" for full_article_publish payloads
  // (the article-publish surface passes a synthetic Change-like object).
  valueKey:
    | "proposed_value"
    | "current_value"
    | "page_url"
    | "html_body"
    | "meta_title"
    | "meta_description"
    | "slug"
    | "anchor_text"
    | "target_url"
    | "source_paragraph_text";
};

export type GuideStep = {
  text: string;                // supports {{placeholder}} substitution
  copyable?: GuideCopyable;    // pulls live from change at render time
  warning?: string;
  screenshot?: string;         // optional /public/guides/...png
};

export type GuideEntry = {
  deliverable: DeliverableType;
  platform: GuidePlatform;
  variant?: string;            // e.g. "yoast" | "rankmath"
  title: string;
  estimatedMinutes: number;
  prerequisites?: string[];
  steps: GuideStep[];
};

// Per-CMS file shape: every CMS file exports a Record keyed by every DeliverableType
// so TypeScript flags missing entries. Variants live alongside under the same deliverable.
export type CmsGuideTable = Record<DeliverableType, GuideEntry | GuideEntry[]>;

export type ResolveResult = {
  entry: GuideEntry;
  mode: "auto" | "manual";
  reason: string;              // e.g. "wordpress + yoast + has app password" or "manual-only platform"
  platform: GuidePlatform;
};
