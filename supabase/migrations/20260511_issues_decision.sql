-- Migration: add decision columns to issues for portal approval workflow
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/grjxnquhrdamncnmjftw/sql
--
-- decision: 'approved' | 'dismissed' | NULL (pending). Surfaced on the
-- /portal/[token]/audit page where clients can approve/dismiss issues
-- one at a time or in bulk, scoping the fix-generation pipeline to only
-- the approved set.

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS decision text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS decided_by text;

CREATE INDEX IF NOT EXISTS issues_decision_idx ON public.issues (audit_run_id, decision);

NOTIFY pgrst, 'reload schema';
