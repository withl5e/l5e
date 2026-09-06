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
        stringToLexical: resolve(
          import.meta.dirname,
          'src/richtext-render/utils/stringToLexical.ts',
        ),
      },
      formats: ['es'],
    },
    rolldownOptions: {
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
