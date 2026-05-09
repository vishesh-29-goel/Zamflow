/**
 * TEST-ONLY AUTH BYPASS — REMOVE BEFORE PRODUCTION
 *
 * This component is only compiled when VITE_TEST_LOGIN_TOKEN is set.
 * It is imported in App.tsx behind the same guard so it is dead-code-eliminated
 * in any build where the env var is absent.
 *
 * Usage: /test-login?token=<VITE_TEST_LOGIN_TOKEN>
 *
 * On match:
 *   1. POSTs to Supabase password token endpoint for audit-bot@zamp.test
 *   2. Writes zampflow.auth.v2 to localStorage in the exact format useAuth expects
 *   3. Reloads to / so AppInner picks up the session
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { config } from '../config';

// These constants are set at build time and tree-shaken if undefined.
const TEST_TOKEN = import.meta.env.VITE_TEST_LOGIN_TOKEN as string | undefined;
const TEST_EMAIL = import.meta.env.VITE_TEST_BOT_EMAIL as string | undefined;
const TEST_PASS  = import.meta.env.VITE_TEST_BOT_PASS  as string | undefined;

const STORAGE_KEY = 'zampflow.auth.v2';

export function TestLogin() {
  const [status, setStatus] = useState<'checking' | 'logging-in' | 'ok' | 'denied' | 'error'>('checking');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // Token lives in the hash query string: /#/test-login?token=...
    // Parse it from the portion after '?' in the hash.
    const hashQuery = window.location.hash.split('?')[1] ?? '';
    const params = new URLSearchParams(hashQuery);
    const urlToken = params.get('token');

    // Guard 1: env var must be set (compile-time)
    if (!TEST_TOKEN) {
      setStatus('denied');
      setMsg('Test login not available in this build.');
      return;
    }
    // Guard 2: URL token must match
    if (!urlToken || urlToken !== TEST_TOKEN) {
      setStatus('denied');
      setMsg('Invalid or missing test token.');
      return;
    }
    // Guard 3: credentials must be present
    if (!TEST_EMAIL || !TEST_PASS) {
      setStatus('error');
      setMsg('Test credentials not configured (missing VITE_TEST_BOT_EMAIL / VITE_TEST_BOT_PASS).');
      return;
    }

    setStatus('logging-in');

    (async () => {
      try {
        // Exchange credentials for a real Supabase session
        const { data, error } = await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASS,
        });

        if (error || !data.session) {
          setStatus('error');
          setMsg(`Supabase sign-in failed: ${error?.message ?? 'no session'}`);
          return;
        }

        const session = data.session;
        const user = data.user;

        // Build the AuthUser object that useAuthStore.loadPersistedUser() expects
        const authUser = {
          email: user.email ?? TEST_EMAIL,
          name: 'Audit Bot',
          picture: '',
          sub: user.id,
          token: '',                        // no Google credential in test mode
          exp: session.expires_at ?? (Math.floor(Date.now() / 1000) + 3600),
          accessToken: session.access_token,
          supabaseUid: user.id,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        setStatus('ok');
        setMsg('Session created. Redirecting...');

        // Hard redirect to root (clear hash) so AppInner reinitialises with the session
        window.location.replace(window.location.origin + '/');
      } catch (e: any) {
        setStatus('error');
        setMsg(`Unexpected error: ${e?.message ?? String(e)}`);
      }
    })();
  }, []);

  const bg: Record<typeof status, string> = {
    checking:   '#f8fafc',
    'logging-in': '#eff6ff',
    ok:         '#f0fdf4',
    denied:     '#fef2f2',
    error:      '#fff7ed',
  };
  const icon: Record<typeof status, string> = {
    checking:   '⏳',
    'logging-in': '🔐',
    ok:         '✅',
    denied:     '🚫',
    error:      '⚠️',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg[status], fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        textAlign: 'center', padding: '2rem 3rem',
        background: 'white', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        maxWidth: 400,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon[status]}</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
          Test Login — Audit Mode
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          {status === 'checking' && 'Verifying token…'}
          {status === 'logging-in' && 'Creating Supabase session…'}
          {status === 'ok' && msg}
          {status === 'denied' && msg}
          {status === 'error' && msg}
        </p>
        {(status === 'denied' || status === 'error') && (
          <a href="/" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: '#6366f1' }}>
            ← Back to app
          </a>
        )}
      </div>
    </div>
  );
}
