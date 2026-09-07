# Runtime script bundles and shared modules

The application's Vite/Rolldown build decides chunk boundaries. L5E preserves
those boundaries when combining the scripts selected by a rendered page.
Use coreVite's chunking interface for shared groups, or chunking: false for raw
Rolldown configuration. Neither needs a second runtime external list.

At server startup, L5E indexes the production manifest. Runtime bundling inlines
selected page entries, while imports to emitted dependency chunks retain their
original asset URLs. The index covers the entire build, including static and
dynamic imports, global bootstrap and React island entries. An entry imported
by another module also retains its original URL, even if selected on the page.

Within a runtime bundle, roots retain the SSR caller's insertion order (duplicates run once).
Static external imports execute before inlined code. When a later root introduces
a dependency or preserved entry that has not executed yet in that graph traversal,
L5E isolates earlier private roots in runtime-generated chunks and combines the
remaining safe suffix in the runtime entry. These chunks are scoped to the page's
script combination; private roots never switch to canonical application URLs.
This may require additional requests to preserve execution order. It prevents a
later dependency from reading global state before an earlier entry initializes
it. Dynamic imports do not create this barrier.

This keeps one instance of an emitted shared module within a browser document.
It works for stores, registries, caches, event buses and library runtime state.
It does not merge distinct packages/module identities already present in the
build, share state with SSR, or persist state between tabs or full reloads.

`client.global.ts` remains the global bootstrap convention. Shared state does
not need to be imported there or named `*.global.ts`. Existing names continue
to work. Runtime bundling no longer identifies dependencies using `vendor-`,
`chunk-`, or `.global` filename substrings.

Dynamic imports retain their lazy boundary and build-generated preload/CSS
behavior. Combining dependencies into a large vendor chunk can make more code
load eagerly; that is a consequence of the application's build configuration.
L5E does not split that chunk again at request time.

Only page entry code is recombined. Side effects local to a page entry can run
again if that entry participates in another runtime bundle. Put state shared
between independently loaded consumers in an imported module; do not rely on
page entry execution as a document-wide singleton mechanism.

Production manifest and bundle policy are scoped to a server's immutable build.
Restart the server when replacing its build. Bundle cache keys include the
output directory and manifest fingerprint. Incomplete policy metadata or an
unknown emitted dependency causes fallback to original script URLs instead of
silently copying module state. The build manifest itself is still required to
map source entries to production assets.

Regression checks:

```sh
pnpm --filter @withl5e/l5e build
pnpm --filter @withl5e/l5e test
pnpm --filter @withl5e/e2e-tests exec playwright install chromium
pnpm --filter @withl5e/e2e-tests test:shared-modules
```

The browser suite builds real multi-entry fixtures through `coreVite()`, serves
them using the production server, and verifies shared identity across two
runtime bundles and a lazy React island. It covers automatic chunks, combined
or separate developer-defined vendor chunks, state absent from global bootstrap,
an entry imported by another entry, dynamic CSS, fragment swap, full reload and
an application base path. Core tests also cover transitive/cyclic imports,
side effects, cache isolation, concurrent bundling, retry and metadata fallback.
