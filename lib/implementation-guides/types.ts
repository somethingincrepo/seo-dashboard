import type { Platform } from "@/lib/connections/types";

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

export type GuideStep = {
  text: string;
  copyable?: { label: string; valueKey: keyof import("@/lib/changes").ChangeFields };
  warning?: string;
  screenshot?: string;
};

export type GuideEntry = {
  deliverable: DeliverableType;
  platform: Platform | "generic";
  variant?: string;
  title: string;
  estimatedMinutes: number;
  prerequisites?: string[];
  steps: GuideStep[];
};

export type ResolveResult = {
  entry: GuideEntry;
  mode: "auto" | "manual";
  reason?: string;
};
