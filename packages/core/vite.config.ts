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
  'rolldown',
  'sirv',
  'vite',
];

export default defineConfig({
  oxc: {
    include: /\.[jt]sx$/,
    jsx: {
      runtime: 'classic',
      pragma: '__l5eJsxFactory',
      pragmaFrag: '__l5eFragment',
    },
    jsxInject:
      'import { Fragment as __l5eFragment, jsxFactory as __l5eJsxFactory } from "@withl5e/l5e/jsx-runtime";',
  },
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'index.ts'),
        'jsx-runtime': resolve(import.meta.dirname, 'src/core/jsx-runtime.ts'),
        'vite-plugin': resolve(import.meta.dirname, 'src/core/vite-plugin.ts'),
        server: resolve(import.meta.dirname, 'src/core/server.ts'),
        'entry-server': resolve(import.meta.dirname, 'src/core/entry-server.ts'),
        middleware: resolve(import.meta.dirname, 'src/middleware/index.ts'),
        tooltip: resolve(import.meta.dirname, 'src/tooltip/index.ts'),
        seo: resolve(import.meta.dirname, 'src/seo/index.ts'),
        swap: resolve(import.meta.dirname, 'src/swap/index.ts'),
        'swap/server': resolve(import.meta.dirname, 'src/swap/server.ts'),
        action: resolve(import.meta.dirname, 'src/action/index.ts'),
        island: resolve(import.meta.dirname, 'src/island/index.ts'),
        'island/client': resolve(import.meta.dirname, 'src/island/client.ts'),
        'island/runtime': resolve(import.meta.dirname, 'src/island/runtime.ts'),
        router: resolve(import.meta.dirname, 'src/router/index.ts'),
        i18n: resolve(import.meta.dirname, 'src/i18n/index.ts'),
      },
      formats: ['es'],
    },
    rolldownOptions: {
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
