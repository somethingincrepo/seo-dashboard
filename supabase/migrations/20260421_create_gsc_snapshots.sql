-- gsc_snapshots table
-- One row per (client_id, week_start). Upserted on every live GSC fetch.
-- week_start is always the Monday of the ISO week (YYYY-MM-DD).
-- Accumulates passively — no separate cron needed.

create table if not exists gsc_snapshots (
  id           bigserial     primary key,
  client_id    text          not null,
  week_start   date          not null,   -- Monday of the week
  clicks       integer       not null default 0,
  impressions  integer       not null default 0,
  avg_position numeric(6,2),
  ctr          numeric(6,4),
  top_queries  jsonb         default '[]', -- top 10 queries [{query,clicks,impressions,position}]
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  constraint   gsc_snapshots_unique unique (client_id, week_start)
);

create index if not exists gsc_snapshots_client_week
  on gsc_snapshots (client_id, week_start desc);

alter table gsc_snapshots enable row level security;

create policy "service role full access"
  on gsc_snapshots for all
  using (true) with check (true);
