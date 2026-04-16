-- Run this in the Supabase SQL editor to create the admin_users table.
-- After running, log in at /login with username "admin" and your current ADMIN_PASSWORD.
-- That first login will auto-create the admin account in Supabase.

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed — we only access this table via the service role key (server-side).
