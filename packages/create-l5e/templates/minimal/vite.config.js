import { coreVite } from '@l5e/core/vite-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  esbuild: {
    jsx: 'preserve',
  },
  plugins: [coreVite()],
  build: {
    outDir: 'dist/client',
    manifest: true,
    rollupOptions: {
      external: (id) => id === 'fsevents',
    },
  },
  optimizeDeps: {
    exclude: ['@l5e/core'],
  },
  ssr: {
    noExternal: ['@l5e/core'],
    external: ['rollup', 'esbuild', 'fsevents'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
});
