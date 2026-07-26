---
title: Architecture
description: How a request becomes a response in L5E — request lifecycle, render context, runtime bundling, and the role of the Vite plugin.
section: Welcome
order: 2
---

# Architecture

L5E is a thin server on top of Express + Vite. Two ideas carry the whole framework.

**1. Per-request bundling, decided on the server.** Components register the CSS/JS they need
into a per-request hook (`AsyncLocalStorage`); after render, L5E merges that exact set into one
`<link>` + one `<script>`. Only the server knows the request's data — and so the exact
components that rendered — so the call is made at runtime. Register nothing, ship **0 KB JS**.
(Why this beats build-time bundling for block-builder pages: [[01-why-l5e]].)

**2. Interactivity is opt-in.** A page ships minimal JS and no framework runtime by default —
what costs JS is *interactivity*, not whether the content changes (loaders still run per
request, so data stays fresh).

- Most content pages need little client-side behavior, so L5E ships none by default.
- Need it? Opt into an **island** ([[20-islands]]) — only that island's JS ships, loaded
  lazily (on idle, on scroll into view).

Everything else is plain functions composing these two ideas.

## Request lifecycle

A request enters through the Express layer; anything that isn't a static asset or an
action call runs inside a single render context. The **middleware** chain wraps the
whole thing — it runs on the way *in* and again on the way *out* — with the
**router → loader → view** pipeline at the core.

<div class="l5e-diag" role="img" aria-label="Request lifecycle: a request enters the middleware chain, which wraps the router, loader and view; middleware runs on the way in and again on the way out before the response">
  <div class="l5e-diag__row">
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">http · express</span>
      <span class="l5e-diag__title">Request</span>
    </div>
  </div>
  <span class="l5e-diag__arrow" aria-hidden="true">▼</span>
  <div class="l5e-diag__group l5e-diag__group--accent">
    <span class="l5e-diag__group-label">middleware · sequence( ) — wraps the request</span>
    <p class="l5e-diag__inout">▼ on the way in</p>
    <div class="l5e-diag__row">
      <div class="l5e-diag__node">
        <span class="l5e-diag__kicker">router</span>
        <span class="l5e-diag__desc">url → view name.</span>
      </div>
      <span class="l5e-diag__arrow" aria-hidden="true">▶</span>
      <div class="l5e-diag__node">
        <span class="l5e-diag__kicker">loader</span>
        <span class="l5e-diag__desc">props + cache directives.</span>
      </div>
      <span class="l5e-diag__arrow" aria-hidden="true">▶</span>
      <div class="l5e-diag__node">
        <span class="l5e-diag__kicker">view</span>
        <span class="l5e-diag__desc">renders to HTML.</span>
      </div>
    </div>
    <p class="l5e-diag__inout">▲ on the way out · read / modify the Response</p>
  </div>
  <span class="l5e-diag__arrow" aria-hidden="true">▼</span>
  <div class="l5e-diag__row">
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">http</span>
      <span class="l5e-diag__title">Response</span>
    </div>
  </div>
</div>

Any `HttpException` thrown in the chain above jumps to the `_error` view
([[12-error-pages]]). `RedirectException` short-circuits to a 30x with `Location`.

## Runtime bundling (the production path)

Once the view has rendered, the framework knows the exact set of CSS files and client
scripts the response needs — they're sitting in the per-request registries. It runs
`bundleScripts(mappedScripts, distClientDir)` and `bundleCss(...)` to merge those
entries into one hashed chunk each, served from an in-memory map.

Because this runs on the request path, concurrent requests can ask for the same chunk
before it exists. Each distinct entry set gets exactly one Rollup run, which every
waiting request shares; a run that fails is not cached, so the next request retries.
Nothing is written to disk along the way — the Rollup entry is a virtual module, and
the finished chunk lives only in the in-memory map. A bundle URL the current process
never built (a stale link from an earlier process, say) has no file to fall back to and
returns 404.

<div class="l5e-diag" role="img" aria-label="Per-request asset collection: hooks push into AsyncLocalStorage registries, the runtime merges only those entries into hashed chunks, and a process-wide cache reuses chunks across pages">
  <div class="l5e-diag__row">
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">request</span>
      <span class="l5e-diag__title"><code>GET /</code></span>
    </div>
    <span class="l5e-diag__arrow" aria-hidden="true">▶</span>
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">jsx runtime</span>
      <span class="l5e-diag__title">render the tree</span>
      <span class="l5e-diag__desc">Only components that actually render run.</span>
    </div>
  </div>
  <span class="l5e-diag__arrow" aria-hidden="true">▼</span>
  <div class="l5e-diag__group">
    <span class="l5e-diag__group-label">per-request · AsyncLocalStorage</span>
    <div class="l5e-diag__row">
      <div class="l5e-diag__node l5e-diag__node--center">
        <svg class="l5e-diag__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/><path d="M14.5 17.5 4.5 15"/></svg>
        <span class="l5e-diag__chip">useCss(path)</span>
      </div>
      <div class="l5e-diag__node l5e-diag__node--center">
        <svg class="l5e-diag__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span class="l5e-diag__chip">useClientJs(path)</span>
      </div>
      <div class="l5e-diag__node l5e-diag__node--center">
        <svg class="l5e-diag__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-4"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/></svg>
        <span class="l5e-diag__chip">&lt;ClientIsland&gt;</span>
      </div>
    </div>
  </div>
  <span class="l5e-diag__arrow" aria-hidden="true">▼</span>
  <div class="l5e-diag__row">
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">runtime bundle</span>
      <span class="l5e-diag__desc"><code>bundleScripts(...)</code> / <code>bundleCss(...)</code> merge <em>only</em> the registered entries into one hashed chunk each.</span>
    </div>
  </div>
  <span class="l5e-diag__arrow" aria-hidden="true">▼</span>
  <div class="l5e-diag__group l5e-diag__group--accent">
    <span class="l5e-diag__group-label">process-wide cache · shared across pages</span>
    <div class="l5e-diag__row">
      <div class="l5e-diag__node l5e-diag__node--accent">
        <span class="l5e-diag__kicker">output</span>
        <span class="l5e-diag__title"><code>/bundle-&lt;hash&gt;.css</code></span>
      </div>
      <div class="l5e-diag__node l5e-diag__node--accent">
        <span class="l5e-diag__kicker">output</span>
        <span class="l5e-diag__title"><code>/bundle-&lt;hash&gt;.js</code></span>
      </div>
    </div>
    <p class="l5e-diag__note">Keyed by the sorted set of registered paths — a later page that registers the same set reuses the same chunk instead of re-bundling. An empty set emits no tag at all (0&nbsp;KB).</p>
  </div>
</div>

The merged file is served at `/bundle-<hash>.js` (and `.css`) with `Cache-Control:
public, max-age=31536000, immutable` because the hash already covers cache
invalidation. Because the cache is keyed by the *set* of paths and lives for the
lifetime of the process, two pages that pull in the same components share one chunk —
the bundling cost is paid once, not per page.

If the page registered no client scripts, the script tag is simply absent. **0 KB JS**
for fully static pages is the default, not a special case.

In dev, no bundling happens — Vite serves each entry on its own URL and HMR handles
updates. The shape of the registered entries is identical, only the delivery is
different.

## Build-time: the Vite plugin

`@withl5e/l5e/vite-plugin` does the work that can't happen at request time. The key
move for bundling: it scans every view for literal `useCss('…')` / `useClientJs('…')`
arguments and turns **each one into its own Rollup input**, so the client build emits
one ready-to-serve target per asset. At request time the runtime only *merges* those
prebuilt targets — it never compiles your source per request.

<div class="l5e-diag" role="img" aria-label="Build time: the Vite plugin scans hook literals and builds one client target per entry, which the runtime later merges">
  <div class="l5e-diag__row">
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">build · vite plugin</span>
      <span class="l5e-diag__title">scan literals</span>
      <span class="l5e-diag__desc">Find every <code>useCss('…')</code> / <code>useClientJs('…')</code> argument across the views (plus islands &amp; actions).</span>
    </div>
    <span class="l5e-diag__arrow" aria-hidden="true">▶</span>
    <div class="l5e-diag__node">
      <span class="l5e-diag__kicker">rollup inputs</span>
      <span class="l5e-diag__title">one target per entry</span>
      <span class="l5e-diag__desc">Each <code>useCss</code> / <code>useClientJs</code> file becomes its own built artifact in <code>dist/client</code>.</span>
    </div>
    <span class="l5e-diag__arrow" aria-hidden="true">▶</span>
    <div class="l5e-diag__node l5e-diag__node--accent">
      <span class="l5e-diag__kicker">at request time</span>
      <span class="l5e-diag__title">merge, don't compile</span>
      <span class="l5e-diag__desc">The runtime bundler stitches the prebuilt targets the page asked for into one chunk.</span>
    </div>
  </div>
</div>

It also generates the virtual modules the SSR runtime imports:

- `virtual:l5e-route` → the user's `src/route.ts` handler
- `virtual:l5e-global-loader` → the user's `src/global-loader.ts` (if present)
- `virtual:l5e-middleware` → the user's `src/middleware.ts` (if present), composed
  via `sequence(...)`
- `virtual:l5e-actions` → action registry mapping `<actionName>_<shortHash>` to
  `{ modulePath, actionName }`, plus a glob of all `actions.tsx` modules

And two more client-side transforms:

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
| Bundling | Off — Vite serves each entry | On — Rollup merges per request |
| Action registry | Read from `virtual:l5e-actions` | Read from `dist/server/action-registry.json` |
