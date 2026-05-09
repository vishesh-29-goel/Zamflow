-- Migration: 2026_05_anon_comments.sql
-- Run this in your Supabase SQL editor or via psql.
CREATE OR REPLACE FUNCTION append_public_comment(
  p_slug TEXT,
  p_node_id TEXT,
  p_comment JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB;
  v_existing JSONB;
BEGIN
  SELECT nodes_meta INTO v_meta
  FROM zampflow_flows
  WHERE public_slug = p_slug AND is_public = true;

  IF v_meta IS NULL THEN
    RAISE EXCEPTION 'Flow not found or not public';
  END IF;

  v_existing := COALESCE(v_meta -> p_node_id, '{}'::jsonb);
  v_existing := jsonb_set(
    v_existing,
    '{comments}',
    COALESCE(v_existing -> 'comments', '[]'::jsonb) || p_comment
  );
  v_meta := jsonb_set(v_meta, ARRAY[p_node_id], v_existing);

  UPDATE zampflow_flows
  SET nodes_meta = v_meta, updated_at = NOW()
  WHERE public_slug = p_slug AND is_public = true;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION append_public_comment(TEXT, TEXT, JSONB) TO anon;
