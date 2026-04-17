-- Invite tokens for gating the public intake/onboarding form.
-- Admin generates a token tied to a package tier and sends it to the prospect.
-- The token is required to submit the intake form and is marked used on submit.

CREATE TABLE IF NOT EXISTS invite_tokens (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  token         TEXT        UNIQUE NOT NULL,
  package_tier  TEXT        NOT NULL CHECK (package_tier IN ('starter', 'growth', 'authority')),
  created_by    TEXT,                          -- admin username who generated it
  notes         TEXT,                          -- optional label, e.g. "For Acme Corp"
  expires_at    TIMESTAMPTZ NOT NULL,          -- default 30 days from creation
  used_at       TIMESTAMPTZ,                   -- set on successful intake submit
  used_by_client_id TEXT,                      -- Airtable record ID of the submitted client
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookups on the validation endpoint
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens (token);
