-- Server-side portal session tracking.
-- The cookie stores a raw UUID (session id). On each request we look up the id
-- here, verify it hasn't expired, and return the associated session data.
-- Rolling-window sessions: last_seen_at is updated on every authenticated request,
-- and expires_at is extended when the session is within the renewal threshold.

create table if not exists portal_sessions (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  portal_token  text not null,
  username      text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  user_agent    text,
  ip            text
);

create index if not exists portal_sessions_expires on portal_sessions(expires_at);
create index if not exists portal_sessions_token   on portal_sessions(portal_token);

-- Login event audit log (both admin and portal attempts).
create table if not exists login_events (
  id             bigserial primary key,
  username       text not null,
  success        boolean not null,
  user_type      text not null,   -- 'admin' | 'portal'
  client_id      text,
  ip             text,
  user_agent     text,
  failure_reason text,            -- 'wrong_password' | 'user_not_found' | 'rate_limited' | 'no_hash'
  created_at     timestamptz not null default now()
);

create index if not exists login_events_username   on login_events(username, created_at desc);
create index if not exists login_events_created_at on login_events(created_at desc);
