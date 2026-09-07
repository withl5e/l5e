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

## Compact mode

`chunking: { mode: 'compact' }` is an experimental production mode that limits the
initial shell and each L5E island activation to at most three **new** JavaScript
assets. The limit is per loading stage, not for the document's whole lifetime:

> The staged activation behavior and `islandRuntime` option described here are
> available on the `1.1.0-alpha.2` prerelease. Stable `1.0.1` does not provide them.

- the shell loads the global bootstrap, page bundle and, when needed, canonical
  shared state;
- a `load` island or a `visible` island already in the viewport activates just
  after the shell and adds its own requests;
- later islands and application dynamic imports add requests only when triggered.

Already cached canonical assets are not new requests. Two different islands that
activate concurrently can therefore have a union larger than three even when each
activation stays within the limit. Application-owned dynamic imports, including SDKs,
keep the chunk graph produced by Vite; audit those graphs separately rather than
assuming L5E can force every arbitrary import below three files.

### Download, evaluate and mount

Compact mode treats three moments separately:

1. **Download.** The shell downloads only shell assets. When an island's strategy
   activates, L5E inserts module preloads for its complete known static JavaScript
   closure, including the island and renderer roots. These requests are scheduled before
   L5E waits for any root response, avoiding a parse-discover-request waterfall.
2. **Evaluate.** Native ESM still controls dependency evaluation, live bindings,
   cycles and side-effect order. Downloading or preloading an asset does not evaluate
   it. A dynamic descendant is neither preloaded nor evaluated until its own import.
3. **Mount or hydrate.** After the strategy activates, L5E waits for the activation's
   CSS and imports, then mounts client-only markup or hydrates SSR markup. Hydration
   does not run before the configured strategy.

No lazy JavaScript is added to the initial HTML as an eager module preload. The
activation plan is small manifest-derived metadata embedded in the page; the browser
does not request a manifest at activation time. CSS belonging to an island remains
lazy and is ready before that island mounts.

Built-in strategies are `load`, `idle`, `visible`, `media` and `none`. A custom
strategy registered with `registerMountStrategy` controls the same download →
evaluate → mount/hydrate sequence by deciding when it calls `mount()`. `none` never
activates the island automatically.

### Ownership and canonical modules

Compact mode accepts one `shared` group. List the store, cache, registry, or other
module roots whose identity must survive imports from different page bundles. Their
minimum static dependency closure joins the canonical shared bundle. For example:

```ts
coreVite({
  chunking: {
    mode: 'compact',
    shared: [{ name: 'state', modules: ['~/stores/session.ts'], packages: ['nanostores'] }],
  },
});
```

This application does not need `islandRuntime`: its only explicit cross-page identity
is the session store. A store belongs in `shared` because every consumer must observe
the same mutable instance. Libraries and helpers stay with the global, page or island
that owns them unless they are part of the store's minimum dependency closure or have
a separate canonical identity requirement.

This is an explicit lifetime contract. L5E does not infer mutability from source text
or package names. A module used only by separate page bundles remains private to each
bundle unless its state root is configured. Modules statically shared by global and
page code are owned and exported by the global bundle so live bindings and one-time
initialization are preserved. A dynamic-only global overlap is rejected because
promoting it would change initialization timing.

In alpha.2, libraries that must be canonical across islands but should remain out of the shell
can join the lazy renderer runtime. Package selectors accept portable package roots or
subpaths; module selectors go through Vite resolution, so aliases such as `~/` remain
application-defined:

```ts
coreVite({
  chunking: {
    mode: 'compact',
    shared: [{ name: 'state', modules: ['~/stores/session.ts'], packages: ['nanostores'] }],
    islandRuntime: {
      packages: ['@nanostores/react', '@tanstack/react-query'],
      modules: ['~/client/use-session.ts', '~/client/query-client.ts'],
    },
  },
});
```

Only the selected roots and their static closure join this runtime. Shared/global
ownership takes precedence, and dynamic descendants do not join it. This keeps React
contexts and client caches single-instance without downloading private island code or
an SDK when the first island activates. An unresolved selector fails the build.

### Generated assets and limits

The production server creates a canonical renderer artifact and one artifact for each
activated island's private static closure. Import maps make original renderer, shared
and global URLs resolve to one final, base-aware URL across swaps. Compact mode thus
requires native import-map support; the default bundling mode remains available for
browsers outside that target.

The alpha renderer bridge supports one Vite entry facade plus one canonical inner
renderer chunk. A different renderer shape fails during server setup. Mapping several
minified export namespaces onto one URL could otherwise make equal aliases refer to
different values, and import maps can map URLs but cannot rename exports.

The application should preserve useful dynamic boundaries. For example, a dialog
island can download its renderer, UI code and CSS when opened while its authentication
SDK stays behind the submit action. Folding that SDK into `islandRuntime` would make
the request count look smaller later by downloading unrelated bytes earlier.

One measured application using the alpha.2 release produced these stages:

| Stage                       | New JS assets |                          Gzip bytes |
| --------------------------- | ------------: | ----------------------------------: |
| Main shell                  |             3 |                              81,965 |
| Open auth dialog            |             2 |                             109,480 |
| Login SDK action            |             2 | included in the next measured union |
| Authenticated avatar island |             1 | included in the next measured union |
| Login + avatar union        |             3 |                               8,752 |
| Tracker shell               |             2 |                              12,473 |
| Tracker `load` island       |             2 |                              84,230 |

Those numbers are evidence from one Vite 8 application, not a general performance
promise. Compared with its alpha.1 build, the main shell was about 49% smaller by gzip,
while shell plus auth-dialog activation was about 20% larger than alpha.1's entire
tested lifecycle bundle. The byte measurements came from the pre-publish candidate at
commit `76ca567`; release CI tested merge commit `5cbdf93` before publishing alpha.2.

Compact mode is opt-in. The default mode retains the existing emitted-chunk behavior
and identity guarantees.

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
