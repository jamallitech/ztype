import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  // Multiple software-rendered WebGL windows saturate local browser automation.
  workers: process.env.CI ? 2 : 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PW_USE_CHROME === 'true' ? { channel: 'chrome' } : {}),
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ...(existsSync('/Applications/Google Chrome.app')
      ? [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }]
      : []),
  ],
  webServer: {
    command: 'npm run dev -w @ztype/web -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_USE_EMULATORS: 'false',
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '',
    },
  },
});
