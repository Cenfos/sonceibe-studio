import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90_000, expect: { timeout: 15_000 }, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 1440, height: 1000 }, launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
  webServer: { command: 'node tests/serve.mjs', url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 60_000 },
  reporter: [['list']],
});
