export type Severity = "critical" | "high" | "medium" | "low";
export type Category = "technical" | "on-page" | "content" | "ai-geo";
export type Scope = "page" | "site";

/** Page row, mirroring the public.pages columns the rules need to read. */
export interface Page {
  id: string;
  url: string;

  status_code: number | null;
  redirect_target: string | null;
  redirect_chain: Array<{ url: string; status: number }> | null;
  response_time_ms: number | null;
  rendered_html_size: number | null;
  is_https: boolean | null;
  mixed_content_count: number | null;

  title: string | null;
  title_length: number | null;
  meta_description: string | null;
  meta_description_length: number | null;

  h1_text: string | null;
  h1_count: number | null;
  h2_count: number | null;
  h3_count: number | null;
  headings: Array<{ level: number; text: string }> | null;
  has_skipped_heading_level: boolean | null;

  canonical_url: string | null;
  canonical_self_referencing: boolean | null;
  canonical_status_code: number | null;
  is_indexable: boolean | null;
  noindex: boolean | null;
  nofollow: boolean | null;
  in_sitemap: boolean | null;

  schema_types: string[] | null;
  schema_blocks: unknown[] | null;
  schema_invalid_count: number | null;

  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_image_status: number | null;
  og_type: string | null;
  twitter_card: string | null;

  hreflang_tags: Array<{ lang: string; href: string }> | null;
  hreflang_invalid: boolean | null;

  internal_links_out: number | null;
  internal_links_in: number | null;
  external_links_out: number | null;
  broken_links_out: Array<{ url: string; status: number }> | null;
  generic_anchor_count: number | null;
  unsafe_blank_target_count: number | null;
  click_depth: number | null;

  word_count: number | null;
  text_to_html_ratio: number | null;
  content_hash: string | null;
  duplicate_of_url: string | null;

  images_count: number | null;
  alt_text_missing_count: number | null;
  alt_text_empty_count: number | null;
  alt_text_too_long_count: number | null;
  alt_text_filename_count: number | null;
  alt_text_duplicate_count: number | null;

  placeholder_text_found: string[] | null;
  unsubstituted_vars: string[] | null;
  has_faq_format: boolean | null;
  has_numbered_steps: boolean | null;
  has_table_without_header: boolean | null;
  has_single_item_list: boolean | null;
  date_published: string | null;
  date_modified: string | null;
  has_author: boolean | null;
  has_table_of_contents: boolean | null;

  page_type: "home" | "article" | "product" | "category" | "other" | null;
  is_nav_page: boolean | null;
}

/** Site-scope context, populated from audit_runs row + per-run aggregates. */
export interface SiteContext {
  root_url: string;
  robots_txt_present: boolean | null;
  robots_txt_content: string | null;
  sitemap_present: boolean | null;
  sitemap_urls: string[] | null;
  llms_txt_present: boolean | null;
  llms_full_txt_present: boolean | null;
  https_enforced: boolean | null;
  hsts_header_present: boolean | null;
}

export interface PageViolation {
  rule_id: string;
  rule_name: string;
  severity: Severity;
  category: Category;
  scope: "page";
  current_value: string;
  expected_value: string;
  evidence?: Record<string, unknown>;
}

export interface SiteViolation {
  rule_id: string;
  rule_name: string;
  severity: Severity;
  category: Category;
  scope: "site";
  current_value: string;
  expected_value: string;
  evidence?: Record<string, unknown>;
}

export type Violation = PageViolation | SiteViolation;

export interface PageRule {
  id: string;
  name: string;
  severity: Severity;
  category: Category;
  scope: "page";
  description: string;
  /** Pure function. Returns null if no violation. */
  check: (page: Page, ctx: { allPages: Page[]; site: SiteContext }) => PageViolation | null;
}

export interface SiteRule {
  id: string;
  name: string;
  severity: Severity;
  category: Category;
  scope: "site";
  description: string;
  check: (ctx: { allPages: Page[]; site: SiteContext }) => SiteViolation | null;
}

export type Rule = PageRule | SiteRule;

/** Helpers used across rules. */
export function isContentPage(page: Page): boolean {
  if (page.status_code !== 200) return false;
  if (page.is_indexable === false) return false;
  return true;
}

export function isOk(page: Page): boolean {
  return page.status_code === 200;
}
