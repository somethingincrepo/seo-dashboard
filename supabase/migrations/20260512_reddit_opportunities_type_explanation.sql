ALTER TABLE public.reddit_opportunities
  ADD COLUMN IF NOT EXISTS ai_explanation text,
  ADD COLUMN IF NOT EXISTS opportunity_type text NOT NULL DEFAULT 'keyword';

CREATE INDEX IF NOT EXISTS reddit_opportunities_type
  ON public.reddit_opportunities (client_id, opportunity_type, relevance_score DESC);

NOTIFY pgrst, 'reload schema';
