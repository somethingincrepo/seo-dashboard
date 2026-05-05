-- content_refreshes table
-- Owns the entire on-page-optimization pipeline. Completely separate from the
-- Airtable Content Jobs/Results tables, which are exclusively for the n8n
-- new-article workflow. One row per refresh job from creation through approval.
--
-- Lifecycle:
--   refresh_scheduler creates rows with status='approved' (auto-approved — the
--     scheduler is the gate, not the client).
--   content_refresh SOP picks up status='approved' rows, fetches the live page,
--     produces marked-up edits, runs validate_refresh, then writes the original
--     snapshot + proposed body + stats and sets status='completed' on success
--     or 'failed' with validation_errors on failure.
--   The portal renders status='completed' rows for client review and approval.
--   On approve, status='approved_for_publish' and publish_article_wordpress
--     queues against this row's id.

create table if not exists content_refreshes (
  id                          uuid          primary key default gen_random_uuid(),

  -- Identity / scheduling
  client_id                   text          not null,             -- main Airtable Clients record ID
  company_name                text          not null,             -- denormalized for filtering
  refresh_url                 text          not null,
  target_keyword              text          not null default '',
  keyword_group               text,
  search_intent               text,
  page_type                   text          not null default 'Blog Post', -- Blog Post | Service Page | Landing Page | Other
  display_title               text          not null default '',  -- shown in the portal sidebar

  -- Lifecycle
  status                      text          not null default 'approved',  -- approved | in_progress | completed | failed | approved_for_publish | published
  proposed_at                 timestamptz   not null default now(),
  generated_at                timestamptz,                       -- when content_refresh finished writing the result
  validation_errors           jsonb         default '[]',         -- non-empty when status='failed'

  -- Original page snapshot (deterministic — populated by extract_page in step 3)
  original_body               text          not null default '',
  original_meta_title         text          not null default '',
  original_meta_description   text          not null default '',
  original_word_count         integer       not null default 0,

  -- Proposed edits (populated when content_refresh succeeds)
  proposed_body               text          not null default '',  -- bracket markup with [CHANGED]/[ADDED]/[REMOVED]
  proposed_meta_title         text          not null default '',
  proposed_meta_description   text          not null default '',
  proposed_excerpt            text          not null default '',
  proposed_outline            text          not null default '',
  proposed_word_count         integer,

  -- Validation stats (from validate_refresh)
  change_ratio                numeric(4,3),
  body_rewrite_pct            numeric(4,3),
  edits_count                 integer       not null default 0,
  additions_count             integer       not null default 0,
  removals_count              integer       not null default 0,

  -- Portal approval
  portal_approval             text,                              -- approved | needs_revision | null
  portal_notes                text,
  portal_approved_at          timestamptz,

  -- Publish
  published_at                timestamptz,
  publish_url                 text,                              -- usually equals refresh_url

  created_at                  timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now()
);

create index if not exists content_refreshes_client_status
  on content_refreshes (client_id, status, proposed_at desc);

create index if not exists content_refreshes_pending_publish
  on content_refreshes (status) where status = 'approved_for_publish';

alter table content_refreshes enable row level security;

create policy "service role full access"
  on content_refreshes for all
  using (true) with check (true);
