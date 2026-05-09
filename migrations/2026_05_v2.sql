-- ZampFlow v2 migration
-- Run in Supabase SQL editor if psycopg2 connection fails

-- 1. Add public sharing columns
ALTER TABLE zampflow_flows
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug TEXT;

-- 2. Add unique constraint on public_slug (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zampflow_flows_public_slug_key'
  ) THEN
    ALTER TABLE zampflow_flows ADD CONSTRAINT zampflow_flows_public_slug_key UNIQUE (public_slug);
  END IF;
END $$;

-- 3. Add nodes_meta JSONB column
ALTER TABLE zampflow_flows
  ADD COLUMN IF NOT EXISTS nodes_meta JSONB DEFAULT '{}';

-- 4. RLS policy: allow anonymous SELECT on public flows
-- First drop if exists to make idempotent
DROP POLICY IF EXISTS "Public flows are readable by anyone" ON zampflow_flows;

CREATE POLICY "Public flows are readable by anyone"
  ON zampflow_flows
  FOR SELECT
  USING (is_public = true);
