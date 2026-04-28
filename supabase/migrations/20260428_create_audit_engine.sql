-- Migration: create deterministic audit engine tables
-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql
--
-- Replaces the agentic audit pipeline. One row per crawl in audit_runs,
-- one row per crawled URL in pages, one row per (page, rule) violation in issues.
-- Rules engine runs deterministically; agentic generation is wired in later.

-- ===========================================================================
-- audit_runs: one per client per crawl
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.audit_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               text NOT NULL,
  client_name             text NOT NULL,
  root_url                text NOT NULL,
  status                  text NOT NULL DEFAULT 'queued',
    -- queued | crawling | crawled | diagnosing | complete | failed
  triggered_by            text NOT NULL,
    -- 'intake' | 'admin_rerun' | 'scheduled'

  crawl_started_at        timestamptz,
  crawl_completed_at      timestamptz,
  diagnose_started_at     timestamptz,
  diagnose_completed_at   timestamptz,

  pages_crawled           int NOT NULL DEFAULT 0,
  issues_found            int NOT NULL DEFAULT 0,

  -- Site-level extracted data (used by site-scope rules)
  robots_txt_present      boolean,
  robots_txt_content      text,
  sitemap_present         boolean,
  sitemap_urls            jsonb,           -- array of urls discovered in sitemap(s)
  sitemap_url_count       int,
  llms_txt_present        boolean,
  llms_full_txt_present   boolean,
  https_enforced          boolean,         -- http root redirects to https
  hsts_header_present     boolean,

  error_message           text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_runs_client_idx
  ON public.audit_runs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_runs_status_idx
  ON public.audit_runs (status);

ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.audit_runs USING (false);

-- ===========================================================================
-- pages: one row per crawled URL per audit_run
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.pages (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id                uuid NOT NULL
    REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  client_id                   text NOT NULL,
  url                         text NOT NULL,

  -- Response
  status_code                 int,
  redirect_target             text,
  redirect_chain              jsonb,         -- [{url, status}, ...]
  response_time_ms            int,
  rendered_html_size          int,
  is_https                    boolean,
  mixed_content_count         int,

  -- Document
  title                       text,
  title_length                int,
  meta_description            text,
  meta_description_length     int,

  -- Headings
  h1_text                     text,
  h1_count                    int,
  h2_count                    int,
  h3_count                    int,
  headings                    jsonb,         -- ordered tree of {level, text}
  has_skipped_heading_level   boolean,

  -- Canonical / indexability
  canonical_url               text,
  canonical_self_referencing  boolean,
  canonical_status_code       int,           -- status of the canonical target
  is_indexable                boolean,       -- robots meta + x-robots-tag
  noindex                     boolean,
  nofollow                    boolean,
  in_sitemap                  boolean,

  -- Schema
  schema_types                jsonb,         -- e.g. ["Organization", "Article"]
  schema_blocks               jsonb,         -- raw parsed JSON-LD blocks
  schema_invalid_count        int,           -- json-ld blocks that failed to parse

  -- Open Graph / Twitter
  og_title                    text,
  og_description              text,
  og_image                    text,
  og_image_status             int,
  og_type                     text,
  twitter_card                text,

  -- Hreflang
  hreflang_tags               jsonb,         -- [{lang, href}]
  hreflang_invalid            boolean,

  -- Links
  internal_links_out          int,
  internal_links_in           int,           -- computed post-crawl
  external_links_out          int,
  broken_links_out            jsonb,         -- [{url, status}]
  generic_anchor_count        int,           -- "click here", "read more", ...
  unsafe_blank_target_count   int,           -- target=_blank without rel=noopener
  click_depth                 int,           -- shortest path from root, computed post-crawl

  -- Content
  word_count                  int,
  text_to_html_ratio          numeric(5,4),
  content_hash                text,          -- normalized text hash for dup detection
  duplicate_of_url            text,          -- set if exact dup detected

  -- Images
  images_count                int,
  alt_text_missing_count      int,
  alt_text_empty_count        int,           -- alt="" on content imgs
  alt_text_too_long_count     int,           -- alt > 125 chars
  alt_text_filename_count     int,           -- alt matches filename pattern
  alt_text_duplicate_count    int,

  -- Patterns / templating
  placeholder_text_found      jsonb,         -- ["lorem ipsum", "TODO", "coming soon"]
  unsubstituted_vars          jsonb,         -- ["{{ name }}", "[client_name]"]
  has_faq_format              boolean,       -- Q-style H2/H3 detected
  has_numbered_steps          boolean,       -- numbered list patterns detected
  has_table_without_header    boolean,
  has_single_item_list        boolean,
  date_published              timestamptz,   -- from schema or meta
  date_modified               timestamptz,
  has_author                  boolean,
  has_table_of_contents       boolean,

  -- Page classification
  page_type                   text,          -- 'home' | 'article' | 'product' | 'category' | 'other'
  is_nav_page                 boolean,

  raw_extraction_errors       jsonb,
  crawled_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pages_audit_run_idx ON public.pages (audit_run_id);
CREATE INDEX IF NOT EXISTS pages_client_idx ON public.pages (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS pages_run_url_uniq
  ON public.pages (audit_run_id, url);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.pages USING (false);

-- ===========================================================================
-- issues: one row per (page, rule) violation
-- page_id is nullable to support site-scope issues (e.g. "robots.txt missing")
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.issues (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id      uuid NOT NULL
    REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  client_id         text NOT NULL,
  page_id           uuid
    REFERENCES public.pages(id) ON DELETE CASCADE,
  page_url          text,                    -- denormalized; null for site-scope issues
  scope             text NOT NULL,           -- 'page' | 'site'
  rule_id           text NOT NULL,
  rule_name         text NOT NULL,
  severity          text NOT NULL,           -- 'critical' | 'high' | 'medium' | 'low'
  category          text NOT NULL,           -- 'technical' | 'on-page' | 'content' | 'ai-geo'
  current_value     text,
  expected_value    text,
  evidence          jsonb,                   -- structured detail (counts, samples, urls)
  proposed_value    text,                    -- empty until generation phase
  detected_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issues_audit_run_idx ON public.issues (audit_run_id);
CREATE INDEX IF NOT EXISTS issues_client_idx ON public.issues (client_id);
CREATE INDEX IF NOT EXISTS issues_severity_idx ON public.issues (severity);
CREATE INDEX IF NOT EXISTS issues_rule_idx ON public.issues (rule_id);
CREATE INDEX IF NOT EXISTS issues_page_idx ON public.issues (page_id);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.issues USING (false);

NOTIFY pgrst, 'reload schema';
