-- ZampFlow Supabase schema
-- Apply via Supabase SQL editor or `python scripts/setup_supabase.py`
-- (script needs SUPABASE_DB_URL, e.g. postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres)

CREATE TABLE IF NOT EXISTS zampflow_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled flow',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zampflow_flows_user_email_idx ON zampflow_flows(user_email);
ALTER TABLE zampflow_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zampflow_select ON zampflow_flows;
CREATE POLICY zampflow_select ON zampflow_flows FOR SELECT
  USING (user_email = current_setting('request.headers', true)::json->>'x-user-email');

DROP POLICY IF EXISTS zampflow_insert ON zampflow_flows;
CREATE POLICY zampflow_insert ON zampflow_flows FOR INSERT
  WITH CHECK (user_email = current_setting('request.headers', true)::json->>'x-user-email');

DROP POLICY IF EXISTS zampflow_update ON zampflow_flows;
CREATE POLICY zampflow_update ON zampflow_flows FOR UPDATE
  USING (user_email = current_setting('request.headers', true)::json->>'x-user-email')
  WITH CHECK (user_email = current_setting('request.headers', true)::json->>'x-user-email');

DROP POLICY IF EXISTS zampflow_delete ON zampflow_flows;
CREATE POLICY zampflow_delete ON zampflow_flows FOR DELETE
  USING (user_email = current_setting('request.headers', true)::json->>'x-user-email');

CREATE OR REPLACE FUNCTION zampflow_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zampflow_flows_updated_at ON zampflow_flows;
CREATE TRIGGER zampflow_flows_updated_at BEFORE UPDATE ON zampflow_flows
FOR EACH ROW EXECUTE FUNCTION zampflow_set_updated_at();
