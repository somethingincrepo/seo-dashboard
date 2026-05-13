-- Portal user credentials, stored in Supabase instead of Airtable.
-- client_id is the Airtable record ID (rec...) for the client.
-- This table is the single source of truth for portal login credentials.
-- Airtable fields (portal_password_hash, portal_password) are kept in sync
-- for backwards compatibility but are no longer read for auth decisions.

create table if not exists portal_users (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null unique,   -- Airtable record ID (rec...)
  portal_token  text not null,          -- UUID that appears in /portal/[token] URL
  username      text not null unique,   -- login username (lowercased)
  password_hash text not null,          -- scrypt hash (salt:hash format)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists portal_users_username  on portal_users(username);
create index if not exists portal_users_token     on portal_users(portal_token);
