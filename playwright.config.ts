import { defineConfig, devices } from '@playwright/test';

const port = 4322;

export default defineConfig({
  testDir: 'e2e',
  // Vitest picks up *.test.ts; the browser tests use *.spec.ts.
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 800 },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  // Serves the built site. The API and sign-in are answered by the tests
  // themselves, so neither Azure nor its emulator is needed.
  webServer: {
    command: `pnpm exec astro preview --port ${port} --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
