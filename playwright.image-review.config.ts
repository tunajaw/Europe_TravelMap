import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/image-review',
  testMatch: '**/*.e2e.ts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4183/Europe_TravelMap/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183/Europe_TravelMap/',
    reuseExistingServer: !process.env.CI,
  },
});
