const { defineConfig, devices } = require('@playwright/test');

require('dotenv').config({ path: require('path').join(__dirname, '.env.e2e') });

const BASE_URL = process.env.E2E_BASE_URL || 'https://dhakimloaimau.vn';

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
