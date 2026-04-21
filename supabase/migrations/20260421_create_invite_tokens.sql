-- Migration: create invite_tokens table
-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql

CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text NOT NULL UNIQUE,
  package_tier    text NOT NULL CHECK (package_tier IN ('starter', 'growth', 'authority')),
  created_by      text,
  notes           text,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  used_by_client_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Row-level security (service role bypasses RLS, anon/auth roles cannot read)
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Only the service role (server-side API) can access tokens
CREATE POLICY "service role only" ON public.invite_tokens
  USING (false);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS invite_tokens_token_idx ON public.invite_tokens (token);

-- Notify PostgREST to reload its schema cache so the table is immediately usable
NOTIFY pgrst, 'reload schema';
