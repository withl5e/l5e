/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { coreVite } from './src/core/vite-plugin';

export default defineConfig({
  plugins: [coreVite()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
});
