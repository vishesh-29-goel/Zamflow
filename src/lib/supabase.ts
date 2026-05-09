import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { NodesMeta } from '../store/types';

// Flow row as returned from Supabase
export interface FlowRow {
  id: string;
  name: string;
  data: FlowData;
  nodes_meta: NodesMeta;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_id?: string;
}

export interface FlowData {
  version: number;
  nodes: any[];
  edges: any[];
  viewport?: { x: number; y: number; zoom: number };
}

// ── Supabase client (anon key, used for auth + public viewer) ─────────────────
// This client is used for:
//   1. supabase.auth.signInWithIdToken() — creates a real Supabase Auth session
//   2. loadPublicFlow() — reading publicly shared flows (no auth needed)
//   3. append_public_comment() — anon RPC for public flow comments
//
// DO NOT use this client for authenticated data operations — use sessionClient()
// which carries the user's session JWT so auth.uid() resolves correctly in RLS.
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

// ── Session-scoped client ─────────────────────────────────────────────────────
// Creates a Supabase client that uses the user's session access token as the
// Authorization header. This makes auth.uid() resolve to the user's UUID in
// every RLS policy, giving proper per-user row isolation.
//
// Call this after supabase.auth.signInWithIdToken() has succeeded and returned
// a session with an access_token.
export function sessionClient(accessToken: string) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

// ── Legacy alias (kept for any remaining call-sites during transition) ────────
// Previously created an anon+email-header client. Now delegates to sessionClient.
// Call-sites should migrate to passing the access token directly.
export function userScoped(accessToken: string) {
  return sessionClient(accessToken);
}

// ── Public flow helpers ───────────────────────────────────────────────────────

export async function loadPublicFlow(slug: string): Promise<FlowRow | null> {
  const { data, error } = await supabase
    .from('zampflow_flows')
    .select('*')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .single();
  if (error || !data) return null;
  return data as FlowRow;
}

export async function setFlowPublic(
  client: ReturnType<typeof sessionClient>,
  id: string,
  isPublic: boolean,
  slug: string | null
): Promise<void> {
  await client
    .from('zampflow_flows')
    .update({ is_public: isPublic, public_slug: slug })
    .eq('id', id);
}

export async function saveNodesMeta(
  client: ReturnType<typeof sessionClient>,
  flowId: string,
  meta: NodesMeta
): Promise<void> {
  await client
    .from('zampflow_flows')
    .update({ nodes_meta: meta })
    .eq('id', flowId);
}
