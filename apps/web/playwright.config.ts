import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  // A preview deployment is cold and shares a staging database with every other
  // PR, so a first failure is as likely to be the environment as the app.
  retries: process.env.CI ? 2 : 0,
  use: { baseURL },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: baseURL,
        reuseExistingServer: true,
      },
});
