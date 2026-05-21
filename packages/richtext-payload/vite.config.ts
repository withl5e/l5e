import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const externalPackages = [
  '@withl5e/l5e',
  '@payloadcms/richtext-lexical',
  'lexical',
  'payload',
  'uuid',
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
        stringToLexical: resolve(__dirname, 'src/richtext-render/utils/stringToLexical.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => {
        if (id.startsWith('node:')) return true;
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
