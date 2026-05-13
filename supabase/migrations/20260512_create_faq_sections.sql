CREATE TABLE IF NOT EXISTS faq_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  page_url text NOT NULL,
  page_title text,
  existing_faq_count integer NOT NULL DEFAULT 0,
  generated_questions jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'suggested',
  portal_approval text,
  portal_approved_at timestamptz,
  portal_notes text,
  priority text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faq_sections_client_id_idx ON faq_sections(client_id);
CREATE INDEX IF NOT EXISTS faq_sections_proposed_at_idx ON faq_sections(proposed_at);
CREATE INDEX IF NOT EXISTS faq_sections_status_idx ON faq_sections(status);
