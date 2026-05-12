ALTER TABLE public.reddit_opportunities
  ADD COLUMN IF NOT EXISTS snippet text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
