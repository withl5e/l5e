---
title: Architecture
description: How a request becomes a response in L5E — request lifecycle, render context, runtime bundling, and the role of the Vite plugin.
section: Welcome
order: 2
---

# Architecture

L5E is a thin server on top of Express + Vite. Most of the framework's behavior lives
in two places: a **per-request render context** (an `AsyncLocalStorage` store) and a
**Vite plugin** that prepares virtual modules at build time. Everything else is plain
functions composing those two surfaces.

## Request lifecycle

```
HTTP request
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│  Express layer                                          │
│  • compression + sirv (prod) or vite middleware (dev)   │
│  • static /public                                       │
│  • /_l5e/action/<key>  ──────────────►  Action handler  │
│  • everything else      ──────────────► render(url)     │
└─────────────────────────────────────────────────────────┘
   │
   ▼  runInRenderContext({ ... AsyncLocalStorage ... })
┌─────────────────────────────────────────────────────────┐
│  1. Middleware chain  (src/middleware.ts → sequence)    │
│  2. routeHandler(requestInfo)  → view name or null      │
│  3. Global loader  (optional, src/global-loader.ts)     │
│     ├─ loader() → props, cacheTags, lang                │
│     └─ generateMetadata / generateSchema (later)        │
│  4. View loader   (optional, views/<name>/loader.ts)    │
│     ├─ loader() → props, maxAge/sMaxAge/swr, cacheTags  │
│     ├─ rawResponse → bypass JSX, emit bytes             │
│     └─ generateMetadata / generateSchema                │
│  5. View component renders (views/<name>/index.tsx)     │
│     ├─ Components call useCss / useClientJs / island    │
│     └─ <Head> entries push into headRegistry            │
│  6. Bundle collected entries on the fly                 │
│     ├─ bundleScripts(...)  →  /bundle-<hash>.js         │
│     └─ bundleCss(...)      →  /bundle-<hash>.css        │
│  7. Apply Cache-Control + Cache-Tag headers             │
│  8. Replace template placeholders → final HTML          │
└─────────────────────────────────────────────────────────┘
   │
   ▼
HTTP response
```

Any `HttpException` thrown anywhere in steps 1–5 jumps to the `_error` view
([[12-error-pages]]). `RedirectException` short-circuits to a 30x with `Location`.

## The per-request render context

The hinge of the whole framework. `runInRenderContext` wraps each render in an
`AsyncLocalStorage` store with these registries:

| Registry | Pushed by | Read by |
|---|---|---|
| `clientJsRegistry` | `useClientJs(path)` | Bundler (step 6) |
| `cssRegistry` | `useCss(path)` | Bundler (step 6) |
| `islandRegistry` | `<ClientIsland>` | Bundler + `window.__L5E_ISLANDS__` |
| `cacheTags` | `cacheTag="…"` props, loader `cacheTags`, `addCacheTag()` | Response headers |
| `headRegistry` | `<Head>`, `MetadataRenderer` | Final HTML head |
| `metadataStack` | `generateMetadata` (global → view) | `MetadataRenderer` |
| `schemaRegistry` | `generateSchema` (global → view) | JSON-LD `<script>` in `<head>` |
| `request` | the request itself | `useRequest()` |
| `viewName` | route handler return | `useRequest().view` |

This is also what makes **per-request bundling** work: only components that actually
render call the hooks, so only their assets enter the registry, so only those assets
end up in the merged chunk.

## Runtime bundling (the production path)

After step 5, the framework knows the exact set of CSS files and client scripts the
response needs. It runs `bundleScripts(mappedScripts, root, distClientDir)` and
`bundleCss(...)` — both wrap esbuild — to merge those entries into one hashed
chunk each. The merged file is served from an in-memory map at
`/bundle-<hash>.js` (and `.css`), with `Cache-Control: public, max-age=31536000,
immutable` because the hash already covers cache invalidation.

If the page registered no client scripts, the script tag is simply absent. **0 KB JS**
for fully static pages is the default, not a special case.

In dev, no bundling happens — Vite serves each entry on its own URL and HMR handles
updates. The shape of the registered entries is identical, only the delivery is
different.

## Build-time: the Vite plugin

`@withl5e/l5e/vite-plugin` does the work that can't happen at request time:

- **Discovers entries** by scanning view files for `useCss('…')` and
  `useClientJs('…')` literal arguments, plus the islands and the actions registry.
  These become Rollup inputs for the client build.
- **Generates virtual modules** the SSR runtime imports:
  - `virtual:l5e-route` → the user's `src/route.ts` handler
  - `virtual:l5e-global-loader` → the user's `src/global-loader.ts` (if present)
  - `virtual:l5e-middleware` → the user's `src/middleware.ts` (if present), composed
    via `sequence(...)`
  - `virtual:l5e-actions` → action registry mapping `<actionName>_<shortHash>` to
    `{ modulePath, actionName }`, plus a glob of all `actions.tsx` modules
- **Transforms `actions.tsx` for the client**: replaces `defineAction(opts)` exports
  with fetch stubs hitting `/_l5e/action/<key>`. The server keeps the real handler;
  the client only ships a function that sends an HTTP request.
- **Detects `src/client.global.ts`** automatically and adds it as a global client
  entry (the only script every page ships, when it exists).

## Actions: a separate transport

`POST` / `GET` to `/_l5e/action/<key>` is handled outside the HTML render path.
Express has JSON-body parsing scoped to `/_l5e/action`, the route validates the key
shape (`<name>_<4-8 hex>`), loads the matching module from the action registry, runs
the handler, and serializes the returned JSX to HTML — same render machinery, no
template, no `<Head>` collection, no cache headers.

The client side (via the Vite transform) treats actions as typed RPC: `searchDocs({q})`
becomes a fetch with `q` in the querystring or JSON body depending on `method`. The
returned HTML fragment is what [[18-swap-and-action]] swaps into the DOM.

## Dev vs production

| Concern | Dev (`tsx server.ts`) | Production (`node dist/server.js`) |
|---|---|---|
| Module loader | Vite's `ssrLoadModule` | Pre-built `dist/server/*.js` |
| Asset delivery | Vite middleware (HMR, transforms) | sirv static + in-memory bundle map |
| `Cache-Control` | Not emitted | Emitted from loader `maxAge`/`sMaxAge`/`swr` |
| `Cache-Tag` | Always emitted as `global,…` | Same, but non-`global` tags are hashed (`global,1u7gb,…`) |
| Bundling | Off — Vite serves each entry | On — esbuild merges per request |
| Action registry | Read from `virtual:l5e-actions` | Read from `dist/server/action-registry.json` |

## What lives where

| Concern | File(s) in the framework |
|---|---|
| Express setup, response building | `packages/core/src/core/server.ts` |
| Render pipeline + error fallback | `packages/core/src/core/entry-server.ts` |
| AsyncLocalStorage + hooks | `packages/core/src/core/jsx-runtime.ts` |
| JSX → HTML string | `packages/core/src/core/render.ts` |
| Build-time scanning + virtual modules | `packages/core/src/core/vite-plugin.ts` |
| Exception classes | `packages/core/src/core/exceptions.ts` |
| Middleware composition | `packages/core/src/middleware/` |
| Islands | `packages/core/src/island/` |
| Actions | `packages/core/src/action/` |
| Swap runtime | `packages/core/src/swap/` |
| SEO metadata | `packages/core/src/seo/` |

The point of dropping these paths in: nothing is hidden behind a façade. If a piece
of behavior is unclear, the source is one open file away.
