/**
 * Typed accessor for runtime config injected by /public/config.js.
 *
 * The values exposed here are non-secret and safe to ship to the browser:
 *   - GOOGLE_CLIENT_ID is a public OAuth client identifier
 *   - SUPABASE_URL is a public REST endpoint
 *   - SUPABASE_ANON_KEY is the public, RLS-gated key (per-user isolation
 *     is enforced by Postgres Row-Level Security policies on the server).
 *
 * The Google client secret and the Supabase service-role key MUST never
 * end up in this file or in the bundle.
 */
export interface ZampFlowConfig {
  GOOGLE_CLIENT_ID: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALLOWED_DOMAIN: string;
}

declare global {
  interface Window {
    __ZAMPFLOW_CONFIG__?: ZampFlowConfig;
  }
}

const fallback: ZampFlowConfig = {
  GOOGLE_CLIENT_ID: "",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "REPLACE_WITH_SUPABASE_ANON_KEY",
  ALLOWED_DOMAIN: "zamp.ai",
};

export const config: ZampFlowConfig =
  (typeof window !== "undefined" && window.__ZAMPFLOW_CONFIG__) || fallback;

// ---- Backward-compat named exports (some modules import these directly) ----
export const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
export const SUPABASE_URL = config.SUPABASE_URL;
export const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
export const ALLOWED_DOMAIN = config.ALLOWED_DOMAIN;

export function configIsValid(): boolean {
  return Boolean(
    config.GOOGLE_CLIENT_ID &&
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_ANON_KEY.startsWith("REPLACE_")
  );
}
