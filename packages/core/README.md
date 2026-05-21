# @l5e/core

L5E is an HTML-first SSR MPA framework for pages where the full HTML response, SEO data,
cache headers and failure behavior should be decided before the response is sent.

Install:

```sh
pnpm add @l5e/core vite
```

Use the Vite plugin in an app:

```ts
import { coreVite } from '@l5e/core/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: { jsx: 'preserve' },
  plugins: [coreVite()],
});
```

See the root README and `examples/basic` for a full app.
