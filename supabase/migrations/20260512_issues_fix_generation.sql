-- Migration: add fix-generation lifecycle columns to issues
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql
--
-- After the audit completes, every in-scope issue gets a proposed_value
-- generated either by the deterministic mechanical-fix generator (free) or
-- by a per-fix-type SOP running on the Fly worker. These columns track that
-- lifecycle. The proposed_value column already exists on the issues table.

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS fix_status text;
  -- NULL (not eligible / not yet attempted)
  -- 'queued'      — agent job enqueued, awaiting worker pickup
  -- 'generating'  — worker actively running the SOP
  -- 'generated'   — proposed_value populated and ready for client review
  -- 'failed'      — generation failed (see fix_error); user can retry
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS fix_generated_at timestamptz;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS fix_attempts int DEFAULT 0;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS fix_error text;

CREATE INDEX IF NOT EXISTS issues_fix_status_idx ON public.issues (audit_run_id, fix_status);

NOTIFY pgrst, 'reload schema';
