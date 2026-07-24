import { coreVite } from '@withl5e/l5e/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  esbuild: {
    jsx: 'preserve',
  },
  plugins: [
    coreVite(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      // Without this, every `vite build` regenerates src/paraglide/* without
      // .d.ts files, wiping out whatever the `i18n:compile` CLI script (which
      // does pass --emit-ts-declarations) produced — breaking typecheck the
      // moment a normal build runs after it.
      emitTsDeclarations: true,
      // 'url' must come first for normal navigation: once a client-side
      // getLocale() call has synced a cookie for whatever page is currently
      // open, putting 'cookie' first would make an explicit navigation to a
      // different locale's URL fight with that stale cookie (Paraglide's own
      // shouldRedirect would bounce it straight back).
      //
      // The tooltip fragment route is fetched with a real locale prefix (see
      // data-tooltip-base on the trigger in views/home/index.tsx) precisely so
      // it resolves via 'url' like any other page — each locale is then a
      // distinct, CDN-cacheable URL instead of a single URL that varies by
      // cookie (which most CDNs can't cache correctly).
      //
      // The action endpoint has no locale-prefixed URL of its own (actions
      // aren't cacheable, cacheable-by-locale-URL doesn't apply), so it opts
      // out of 'url' entirely via routeStrategies — cookie decides for it.
      strategy: ['url', 'cookie', 'baseLocale'],
      routeStrategies: [
        {
          match: ':protocol://:domain(.*)::port?/_l5e/:path(.*)?',
          strategy: ['cookie', 'baseLocale'],
        },
      ],
      urlPatterns: [
        {
          pattern: ':protocol://:domain(.*)::port?/:path(.*)?',
          localized: [
            ['vi', ':protocol://:domain(.*)::port?/vi/:path(.*)?'],
            ['en', ':protocol://:domain(.*)::port?/:path(.*)?'],
          ],
        },
      ],
      cookieName: 'DEMO_LOCALE',
    }),
    // Scoped to island files only — l5e's own JSX transform (jsxFactory,
    // configured below) handles every other .tsx file.
    react({ include: [/\.react\.(t|j)sx$/, /[\\/]react[\\/][^/\\]+\.(t|j)sx$/] }),
  ],
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
    port: 5179,
  },
});
