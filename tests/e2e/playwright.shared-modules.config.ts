import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  testMatch: 'shared-modules.spec.ts',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  outputDir: '../../.l5e-temp/shared-module-results',
  use: { ...devices['Desktop Chrome'] },
});
