# @withl5e/l5e

L5E is an HTML-first SSR MPA framework for pages where the full HTML response, SEO data,
cache headers and failure behavior should be decided before the response is sent.

Install:

```sh
pnpm add @withl5e/l5e vite
```

Use the Vite plugin in an app:

```ts
import { coreVite } from '@withl5e/l5e/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  oxc: { jsx: 'preserve' },
  plugins: [coreVite()],
});
```

See the root README and `examples/basic` for a full app.

Compact chunking is experimental and opt-in:

```ts
coreVite({
  chunking: {
    mode: 'compact',
    shared: [{ name: 'state', modules: ['~/stores/session.ts'] }],
    islandRuntime: {
      packages: ['@tanstack/react-query'],
      modules: ['~/client/query-client.ts'],
    },
  },
});
```

Compact mode limits the initial shell and each later island/action activation to
at most three new JavaScript assets. `load` and already-visible islands activate
immediately after the shell, so the cumulative cold request count can be higher.
The runtime starts every known static dependency request in parallel, waits for
the island CSS, then evaluates and mounts or hydrates. Dynamic descendants remain
lazy. List state that must survive page-bundle swaps in `shared`; list React
contexts or client caches that multiple islands must share in `islandRuntime`.
Only the configured static closure is included, and dynamic imports are not
promoted. Compact mode requires native import-map support.

The alpha renderer bridge expects Vite to emit one entry facade and one canonical
renderer export chunk. A different renderer shape is rejected during server setup
because merging multiple minified export namespaces can make aliases ambiguous.
