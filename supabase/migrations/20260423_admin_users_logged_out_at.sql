ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS logged_out_at timestamptz;
