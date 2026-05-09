import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { config } from '../config';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'zampflow.auth.v2';

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
  // Google credential JWT (used for re-authentication if needed)
  token: string;
  exp: number;
  // Supabase session — populated after signInWithIdToken succeeds.
  // accessToken is the JWT that must be passed to sessionClient() for all
  // authenticated Supabase operations so that auth.uid() resolves in RLS.
  accessToken: string;
  supabaseUid: string;
}

interface GoogleJwtPayload {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  hd?: string;
  iat: number;
  exp: number;
}

interface AuthStore {
  user: AuthUser | null;
  authError: string | null;
  signIn: (credential: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  clearError: () => void;
  checkExpiry: () => boolean;
}

function loadPersistedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    if (Date.now() / 1000 > user.exp) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Must have a valid Supabase access token to be usable
    if (!user.accessToken || !user.supabaseUid) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: loadPersistedUser(),
  authError: null,

  signIn: async (credential: string) => {
    try {
      const payload = jwtDecode<GoogleJwtPayload>(credential);
      const domain = config.ALLOWED_DOMAIN;

      if (payload.hd !== domain) {
        const msg = `Only @${domain} accounts are allowed. Got domain: ${payload.hd ?? 'none'}`;
        set({ authError: msg });
        return { ok: false, error: msg };
      }

      if (!payload.email.endsWith(`@${domain}`)) {
        const msg = `Only @${domain} accounts are allowed.`;
        set({ authError: msg });
        return { ok: false, error: msg };
      }

      if (!payload.email_verified) {
        const msg = 'Email not verified. Please verify your Google account first.';
        set({ authError: msg });
        return { ok: false, error: msg };
      }

      if (Date.now() / 1000 > payload.exp) {
        const msg = 'Sign-in token expired. Please try again.';
        set({ authError: msg });
        return { ok: false, error: msg };
      }

      // ── Exchange Google credential for a real Supabase Auth session ──────────
      // This call:
      //   1. Creates/retrieves the user in auth.users (populates user_id for RLS)
      //   2. Returns a session with an access_token (the JWT auth.uid() reads)
      //   3. Enables all RLS policies that use auth.uid() = user_id
      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
      });

      if (authError || !authData.session) {
        const msg = `Authentication failed: ${authError?.message ?? 'No session returned'}`;
        set({ authError: msg });
        return { ok: false, error: msg };
      }

      const session = authData.session;

      const user: AuthUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
        token: credential,
        exp: payload.exp,
        accessToken: session.access_token,
        supabaseUid: session.user.id,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      set({ user, authError: null });
      return { ok: true };
    } catch (e) {
      const msg = 'Failed to sign in. Please try again.';
      set({ authError: msg });
      return { ok: false, error: msg };
    }
  },

  signOut: () => {
    localStorage.removeItem(STORAGE_KEY);
    // Also sign out of Supabase Auth session
    supabase.auth.signOut().catch(() => {});
    set({ user: null, authError: null });
  },

  clearError: () => set({ authError: null }),

  checkExpiry: () => {
    const { user, signOut } = get();
    if (!user) return false;
    if (Date.now() / 1000 > user.exp) {
      signOut();
      return false;
    }
    return true;
  },
}));
