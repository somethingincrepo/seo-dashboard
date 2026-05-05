-- Adds two observability columns to audit_runs so the diagnose route can
-- surface "what fired and what didn't" on the admin client detail page and
-- so the portal internal-links empty state can explain WHY there are no
-- proposals (healthy site vs. pipeline error vs. no audit yet).
--
-- Both columns are read-best-effort throughout the codebase — schema is
-- forward-compatible if this migration is rolled out after deploys.

ALTER TABLE audit_runs
  ADD COLUMN IF NOT EXISTS internal_links_summary jsonb,
  ADD COLUMN IF NOT EXISTS completion_summary jsonb;

COMMENT ON COLUMN audit_runs.internal_links_summary IS
  'Snapshot of the internal-links pipeline result: status, message, issues_seen, proposals_generated, changes_written.';
COMMENT ON COLUMN audit_runs.completion_summary IS
  'Snapshot of the audit completion: pages, issues, mechanical_fixes, internal_links, jobs_enqueued map.';
