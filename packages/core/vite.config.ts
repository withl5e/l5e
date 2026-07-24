import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const externalPackages = [
  '@withl5e/l5e',
  '@floating-ui/dom',
  'compression',
  'esbuild',
  'express',
  'path-to-regexp',
  'request-ip',
  'react',
  'react-dom',
  'rollup',
  'sirv',
  'vite',
];

export default defineConfig({
  esbuild: {
    jsxFactory: 'jsxFactory',
    jsxFragment: '__Fragment',
    jsxInject:
      'import { Fragment as __Fragment, jsxFactory } from "@withl5e/l5e/jsx-runtime";',
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
        'jsx-runtime': resolve(__dirname, 'src/core/jsx-runtime.ts'),
        'vite-plugin': resolve(__dirname, 'src/core/vite-plugin.ts'),
        server: resolve(__dirname, 'src/core/server.ts'),
        'entry-server': resolve(__dirname, 'src/core/entry-server.ts'),
        middleware: resolve(__dirname, 'src/middleware/index.ts'),
        tooltip: resolve(__dirname, 'src/tooltip/index.ts'),
        seo: resolve(__dirname, 'src/seo/index.ts'),
        swap: resolve(__dirname, 'src/swap/index.ts'),
        'swap/server': resolve(__dirname, 'src/swap/server.ts'),
        action: resolve(__dirname, 'src/action/index.ts'),
        island: resolve(__dirname, 'src/island/index.ts'),
        'island/client': resolve(__dirname, 'src/island/client.ts'),
        'island/runtime': resolve(__dirname, 'src/island/runtime.ts'),
        router: resolve(__dirname, 'src/router/index.ts'),
        i18n: resolve(__dirname, 'src/i18n/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => {
        if (id.startsWith('virtual:')) return true;
        if (id.startsWith('node:')) return true;
        if (
          [
            'fs',
            'path',
            'os',
            'crypto',
            'http',
            'https',
            'stream',
            'util',
            'events',
            'async_hooks',
            'fsevents',
          ].includes(id)
        ) {
          return true;
        }
        return externalPackages.some((dep) => id === dep || id.startsWith(`${dep}/`));
      },
      output: {
        entryFileNames: '[name].js',
        preserveModules: false,
      },
    },
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
  },
});
