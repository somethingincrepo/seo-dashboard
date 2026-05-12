create table if not exists page_creation_suggestions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  company_name text not null,
  suggested_slug text not null,
  page_title text not null,
  page_type text not null,
  target_keyword text not null,
  reasoning text not null,

  status text not null default 'suggested',
  portal_approval text,
  portal_approved_at timestamptz,
  portal_notes text,
  proposed_at timestamptz not null default now(),

  generated_meta_title text,
  generated_meta_description text,
  generated_h1 text,
  generated_body text,
  generated_word_count int,
  generated_at timestamptz,

  content_portal_approval text,
  content_portal_approved_at timestamptz,
  content_portal_notes text,

  published_at timestamptz,
  publish_url text,
  generator_job_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_creation_suggestions_client_proposed
  on page_creation_suggestions(client_id, proposed_at desc);

create index if not exists page_creation_suggestions_status
  on page_creation_suggestions(status);
