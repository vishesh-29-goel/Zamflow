import React, { useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Layers } from 'lucide-react';
import { useAuthStore } from '../auth/useAuth';
import { config } from '../config';

export function SignInScreen() {
  const { signIn, authError, clearError } = useAuthStore();

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center gap-6"
        style={{ minWidth: 340, maxWidth: 400 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center shadow-md">
            <Layers size={22} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            ZampFlow
          </span>
        </div>

        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Sign in to save your flowcharts
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            @{config.ALLOWED_DOMAIN} accounts only
          </p>
        </div>

        {authError && (
          <div className="w-full rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 text-center">
            {authError}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <GoogleLogin
            onSuccess={({ credential }) => {
              if (!credential) return;
              signIn(credential);
            }}
            onError={() => {
              useAuthStore.setState({
                authError: 'Google sign-in failed. Please try again.',
              });
            }}
            hosted_domain={config.ALLOWED_DOMAIN}
            useOneTap={false}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          Your flows are stored securely in Supabase.
          <br />
          Only visible to you.
        </p>
      </div>
    </div>
  );
}
