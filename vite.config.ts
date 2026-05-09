import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// AUDIT BUILD — test login bypass is active.
// Set VITE_TEST_LOGIN_TOKEN, VITE_TEST_BOT_EMAIL, VITE_TEST_BOT_PASS at build time only.
// These are consumed by src/components/TestLogin.tsx.
// Remove this entire block (or unset the env vars) before the final production deploy.
const testLoginToken = process.env.VITE_TEST_LOGIN_TOKEN ?? '';
const testBotEmail   = process.env.VITE_TEST_BOT_EMAIL   ?? '';
const testBotPass    = process.env.VITE_TEST_BOT_PASS    ?? '';

export default defineConfig({
  plugins: [react()],
  define: {
    // Only inject when actually set — empty string = feature disabled
    ...(testLoginToken ? {
      'import.meta.env.VITE_TEST_LOGIN_TOKEN': JSON.stringify(testLoginToken),
      'import.meta.env.VITE_TEST_BOT_EMAIL':   JSON.stringify(testBotEmail),
      'import.meta.env.VITE_TEST_BOT_PASS':    JSON.stringify(testBotPass),
    } : {}),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-v2.js`,
        chunkFileNames: `assets/[name]-[hash]-v2.js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
})
