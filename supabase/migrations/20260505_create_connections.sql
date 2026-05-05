-- Migration: connections subsystem
-- Per-client encrypted CMS credentials, replacing plaintext PATs in Airtable.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  display_name text,
  external_site_id text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_publish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connections_platform_check CHECK (
    platform IN (
      'wordpress_self',
      'shopify',
      'hubspot',
      'webflow',
      'cloudflare',
      'framer',
      'squarespace',
      'wix'
    )
  ),
  CONSTRAINT connections_status_check CHECK (
    status IN ('active', 'expired', 'revoked', 'error', 'manual_only', 'pending_oauth')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_unique_idx
  ON public.connections (client_id, platform, COALESCE(external_site_id, ''));

CREATE INDEX IF NOT EXISTS connections_client_idx
  ON public.connections (client_id);

CREATE INDEX IF NOT EXISTS connections_status_idx
  ON public.connections (status);

CREATE TABLE IF NOT EXISTS public.connection_events (
  id bigserial PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connection_events_type_check CHECK (
    event_type IN (
      'connected',
      'verified',
      'published',
      'publish_failed',
      'revoked',
      'health_check_failed',
      'capabilities_changed',
      'token_refreshed',
      'oauth_started',
      'oauth_failed'
    )
  )
);

CREATE INDEX IF NOT EXISTS connection_events_conn_idx
  ON public.connection_events (connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  client_id text NOT NULL,
  platform text NOT NULL,
  redirect_after text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS oauth_states_expires_idx
  ON public.oauth_states (expires_at);

ALTER TABLE public.connections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.connections;
CREATE POLICY service_role_all ON public.connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all ON public.connection_events;
CREATE POLICY service_role_all ON public.connection_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all ON public.oauth_states;
CREATE POLICY service_role_all ON public.oauth_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.connections_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS connections_updated_at ON public.connections;
CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.connections_set_updated_at();

NOTIFY pgrst, 'reload schema';
