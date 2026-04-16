-- Run this in the Supabase SQL editor to add role + client assignment support.
-- Safe to run multiple times (IF NOT EXISTS / column checks).

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS assigned_client_ids TEXT[] DEFAULT '{}';
