---
title: Client chunks
description: Global, page, island and shared output with runtime bundling.
section: Interactivity
order: 29
---

# Client chunks (1.1 alpha)

L5E builds four kinds of client output: `global-*`, `bundle-*` for pages and
dynamic imports, `island-*`, and `shared-*`. These are categories, not a promise
of exactly four requests. Bundler runtime helpers are shared output too.

The default follows the import graph. Private helpers stay with their consumer.
Dependencies with the same static consumers can share a chunk; dynamic import
targets are distinct consumers. A shared module has one emitted identity and
the runtime page bundler imports that identity rather than copying its body.

Projects can group packages and source modules through one interface:

```ts
coreVite({
  chunking: {
    shared: [
      { name: 'state', modules: ['~/stores/session.ts'] },
      { name: 'react', packages: ['react', 'react-dom', 'scheduler'] },
      { name: 'editor', packages: ['your-editor-package'], maxSize: 200_000 },
    ],
  },
});
```

`modules` uses Vite resolution, including aliases. `packages` matches exact
package names and their subpaths, including pnpm layouts. Only imported modules
participate; configuration does not add entries. Higher `priority` wins overlaps;
ties use declaration order. Overlaps and unused groups produce warnings.
`maxSize` is an approximate uncompressed split target, not a gzip budget.

Explicit groups can combine modules used by different consumers, accepting
additional bytes for fewer files. L5E partitions each group by earliest activation:
global, page, island, or the exact set of dynamic import roots. Thus a store used
by global and an SDK used only through `import()` remain separate even when
assigned the same group. Different islands can share a configured library chunk;
loading one may download code used by another. Execution order is preserved.

A static import still requires its dependency. Chunk configuration cannot turn a
static SDK import into a lazy one. Put `import()` at the interaction in source.
Do not put independent store instances in page entry bodies: private page code
may execute again when another script combination loads. Export shared state
from an imported module instead. This is document-local identity, not SSR state
sharing, cross-tab state, or deduplication of different installed package versions.

Build output includes `.vite/l5e-chunks.json` with each chunk's category, byte
size, imports, modules, consumers and placement reason. The standard Vite
manifest remains the runtime contract; no second external list is needed.
Global and selected page static dependencies are preloaded recursively. Islands
and dynamic imports retain demand loading and their generated CSS loading.

For raw Rolldown chunk rules, use `coreVite({ chunking: false })` and configure
`build.rolldownOptions.output` yourself. Runtime identity protection remains on.
Combining raw chunk rules with L5E's planner is rejected to avoid ambiguous rules.

Runtime bundles preserve SSR script registration order. When external dependency
evaluation requires it, an earlier private script remains a separate runtime
chunk. Correct evaluation takes precedence over eliminating every small file.
The server indexes one immutable build; restart it after replacing build output.
