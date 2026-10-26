import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'e2e.spec.js', workers: 1, reporter: 'list',
  expect: { timeout: 15000 },
  globalTeardown: './e2e-teardown.js',
  use: { baseURL: 'http://127.0.0.1:4101', browserName: 'chromium', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'node e2e-server.js', url: 'http://127.0.0.1:4101/api/health', reuseExistingServer: false, timeout: 120000 },
});
