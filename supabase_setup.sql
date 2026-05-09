-- ZampFlow multi-flow persistence schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ooghwnajevhyapgwackc/sql

CREATE TABLE IF NOT EXISTS zampflow_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled flow',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zampflow_flows_user_email_idx ON zampflow_flows(user_email);
CREATE INDEX IF NOT EXISTS zampflow_flows_updated_at_idx ON zampflow_flows(updated_at DESC);

-- Enable RLS
ALTER TABLE zampflow_flows ENABLE ROW LEVEL SECURITY;

-- Policy: users can read/write only rows matching their email header
CREATE POLICY IF NOT EXISTS zampflow_flows_select ON zampflow_flows
  FOR SELECT
  USING (user_email = current_setting('request.headers', true)::json->>'x-user-email');

CREATE POLICY IF NOT EXISTS zampflow_flows_insert ON zampflow_flows
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.headers', true)::json->>'x-user-email');

CREATE POLICY IF NOT EXISTS zampflow_flows_update ON zampflow_flows
  FOR UPDATE
  USING (user_email = current_setting('request.headers', true)::json->>'x-user-email')
  WITH CHECK (user_email = current_setting('request.headers', true)::json->>'x-user-email');

CREATE POLICY IF NOT EXISTS zampflow_flows_delete ON zampflow_flows
  FOR DELETE
  USING (user_email = current_setting('request.headers', true)::json->>'x-user-email');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION zampflow_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zampflow_flows_set_updated_at ON zampflow_flows;
CREATE TRIGGER zampflow_flows_set_updated_at
BEFORE UPDATE ON zampflow_flows
FOR EACH ROW EXECUTE FUNCTION zampflow_set_updated_at();

-- Verify
SELECT 'zampflow_flows table created successfully' as status;
