/* ZampFlow runtime config.
 *
 * This file is loaded by index.html before the React bundle and exposes
 * non-secret public values to the app via window.__ZAMPFLOW_CONFIG__.
 *
 * The Supabase anon key is a public, RLS-gated key. It is safe to ship
 * to the browser. Paste yours below and (re)deploy.
 */
window.__ZAMPFLOW_CONFIG__ = {
  GOOGLE_CLIENT_ID: "842261458764-ha1sr0ji8ns7g5tkmkev21kt45s8prhb.apps.googleusercontent.com",
  SUPABASE_URL: "https://ooghwnajevhyapgwackc.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZ2h3bmFqZXZoeWFwZ3dhY2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.7Gafi8lQ764RgqgQf2AM2Fv44XS_dL7oloQt2JImDuo",
  ALLOWED_DOMAIN: "zamp.ai"
};
