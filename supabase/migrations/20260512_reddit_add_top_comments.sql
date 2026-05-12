ALTER TABLE public.reddit_opportunities
  ADD COLUMN IF NOT EXISTS top_comments jsonb;

NOTIFY pgrst, 'reload schema';
