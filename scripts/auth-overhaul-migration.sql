-- Auth overhaul migration (2026-05-12)
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql
-- Safe to run multiple times (all statements use IF NOT EXISTS).

-- ─── 1. portal_users ──────────────────────────────────────────────────────────
-- Authoritative store for portal login credentials.
-- Replaces the fragile Airtable portal_password_hash field.

CREATE TABLE IF NOT EXISTS portal_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT NOT NULL UNIQUE,   -- Airtable record ID (rec...)
  portal_token  TEXT NOT NULL,          -- UUID in /portal/[token] URL
  username      TEXT NOT NULL UNIQUE,   -- login username (lowercased)
  password_hash TEXT NOT NULL,          -- scrypt hash (salt:hash format)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_users_username ON portal_users(username);
CREATE INDEX IF NOT EXISTS portal_users_token    ON portal_users(portal_token);

-- ─── 2. portal_sessions ───────────────────────────────────────────────────────
-- Server-side session tracking. Cookie stores the session UUID.
-- Rolling sessions: expires_at is extended on every authenticated request.

CREATE TABLE IF NOT EXISTS portal_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT NOT NULL,
  portal_token  TEXT NOT NULL,
  username      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent    TEXT,
  ip            TEXT
);

CREATE INDEX IF NOT EXISTS portal_sessions_expires ON portal_sessions(expires_at);
CREATE INDEX IF NOT EXISTS portal_sessions_token   ON portal_sessions(portal_token);

-- ─── 3. login_events ──────────────────────────────────────────────────────────
-- Audit log for all login attempts (admin + portal).

CREATE TABLE IF NOT EXISTS login_events (
  id             BIGSERIAL PRIMARY KEY,
  username       TEXT NOT NULL,
  success        BOOLEAN NOT NULL,
  user_type      TEXT NOT NULL,   -- 'admin' | 'portal'
  client_id      TEXT,
  ip             TEXT,
  user_agent     TEXT,
  failure_reason TEXT,            -- 'wrong_password' | 'user_not_found' | 'rate_limited' | 'no_hash'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_events_username   ON login_events(username, created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_created_at ON login_events(created_at DESC);

-- No RLS needed — all access via service role key (server-side only).
