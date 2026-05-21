import { coreVite } from '@withl5e/l5e/vite-plugin';
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
    exclude: ['@withl5e/l5e'],
  },
  ssr: {
    noExternal: ['@withl5e/l5e'],
    external: ['rollup', 'esbuild', 'fsevents'],
  },
  resolve: {
    conditions: ['development', 'default'],
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5175,
  },
});
