import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/accounts',
  outputDir: './test-results/accounts',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    ...(existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -w @ztype/api',
      url: 'http://127.0.0.1:3002/api/health',
      env: {
        PORT: '3002',
        GOOGLE_CLOUD_PROJECT: 'demo-ztype',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      },
    },
    {
      command: 'npm run dev -w @ztype/web -- --port 4174',
      url: 'http://127.0.0.1:4174',
      env: { VITE_USE_EMULATORS: 'true', VITE_API_PROXY: 'http://127.0.0.1:3002' },
    },
  ],
});
