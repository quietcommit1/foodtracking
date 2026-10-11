import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH ??
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    headless: true,
  },
  webServer: [
    {
      command:
        'VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=public-test-key npm exec vite -- build --outDir /tmp/everyday-pwa-tests && npm run preview -- --outDir /tmp/everyday-pwa-tests --port 5175',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
    },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    {
      command: 'npm run dev -- --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
      },
    },
  ],
  reporter: 'list',
});
