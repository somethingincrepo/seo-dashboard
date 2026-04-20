-- keyword_snapshots table
-- One row per client — stores the latest DataForSEO keyword intelligence snapshot.
-- Upserted on conflict with client_id (the unique key).

create table if not exists keyword_snapshots (
  client_id   text        not null primary key,
  keywords    jsonb       not null default '[]',
  refreshed_at timestamptz not null default now()
);

-- Row-level security: allow the service-role key full access (used by the dashboard API).
-- No public/anon access needed.
alter table keyword_snapshots enable row level security;

create policy "service role full access"
  on keyword_snapshots
  for all
  using (true)
  with check (true);
