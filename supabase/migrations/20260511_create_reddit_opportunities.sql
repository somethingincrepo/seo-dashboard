CREATE TABLE IF NOT EXISTS public.reddit_opportunities (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         text        NOT NULL,
  reddit_post_id    text        NOT NULL,
  title             text        NOT NULL DEFAULT '',
  url               text        NOT NULL DEFAULT '',
  permalink         text        NOT NULL DEFAULT '',
  subreddit         text        NOT NULL DEFAULT '',
  keyword           text        NOT NULL DEFAULT '',
  upvotes           integer     NOT NULL DEFAULT 0,
  num_comments      integer     NOT NULL DEFAULT 0,
  created_utc       timestamptz NOT NULL,
  scraped_at        timestamptz NOT NULL DEFAULT now(),
  source            text        NOT NULL DEFAULT 'reddit_api',
  relevance_score   integer     NOT NULL DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 100),
  ranks_on_google   boolean     NOT NULL DEFAULT false,
  status            text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'viewed', 'replied', 'dismissed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reddit_opportunities_unique UNIQUE (client_id, reddit_post_id)
);

CREATE INDEX IF NOT EXISTS reddit_opportunities_client_score
  ON public.reddit_opportunities (client_id, relevance_score DESC, scraped_at DESC);

CREATE INDEX IF NOT EXISTS reddit_opportunities_status
  ON public.reddit_opportunities (status, client_id);

ALTER TABLE public.reddit_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
  ON public.reddit_opportunities FOR ALL
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
