# Dev-mode navigation CSS flash

Research date: 2026-08-10

Implementation update: the framework adopted the optional `src/global.css`
convention. Its presence declares the global stylesheet; the Vite plugin builds
it as a standalone CSS entry and the server emits it in `<head>` using the
source URL in development and the hashed manifest file in production.

## Conclusion

The flash is a dev-only FOUC caused by how **global CSS** is loaded, not by the
already-fixed duplicate `useCss()` registrations.

L5E currently teaches applications to import global CSS from
`src/client.global.ts`. In development, L5E emits that file as a module script
at the end of the body. Vite transforms a CSS import in a JavaScript module into
client-side style injection. On every ordinary anchor navigation, the browser
replaces the whole document, so the old injected `<style>` disappears. The new
HTML can then paint with user-agent defaults before the module graph has loaded,
executed, and injected the new `<style>`. That interval is the observed white
flash and temporary loss of layout.

The production path does not have the same ordering: L5E reads the CSS files
associated with the `client.global.ts` manifest entry and emits stylesheet
links into the document head before sending the page.

## Evidence from this repository

1. The documented global-CSS contract is to import CSS from
   `src/client.global.ts` ([Global CSS docs](https://github.com/withl5e/l5e/blob/e788ca2/docs-site/content/15-global-css.md#L8-L12)).
2. Both starter templates and the basic example follow that contract by doing
   `import './global.css'` ([basic template](https://github.com/withl5e/l5e/blob/e788ca2/packages/create-l5e/templates/basic/src/client.global.ts),
   [minimal template](https://github.com/withl5e/l5e/blob/e788ca2/packages/create-l5e/templates/minimal/src/client.global.ts),
   [basic example](https://github.com/withl5e/l5e/blob/e788ca2/examples/basic/src/client.global.ts)).
   The docs site imports four global stylesheets through the same JavaScript
   entry ([docs-site client.global.ts](https://github.com/withl5e/l5e/blob/e788ca2/docs-site/src/client.global.ts#L1-L6)).
3. In development, the server prepends `/src/client.global.ts` to the script
   list and serializes all scripts as `<script type="module">` at the body
   placeholder ([server.ts, dev global entry](https://github.com/withl5e/l5e/blob/e788ca2/packages/core/src/core/server.ts#L363-L387),
   [body insertion](https://github.com/withl5e/l5e/blob/e788ca2/packages/core/src/core/server.ts#L389-L399)).
4. Per-view CSS registered by `useCss()` follows a different path: in dev it is
   emitted as `<link rel="stylesheet">` and inserted in the head
   ([server.ts, dev CSS](https://github.com/withl5e/l5e/blob/e788ca2/packages/core/src/core/server.ts#L355-L360),
   [head insertion](https://github.com/withl5e/l5e/blob/e788ca2/packages/core/src/core/server.ts#L389-L398)).
5. In production, CSS attached by Vite to the `src/client.global.ts` manifest
   entry is explicitly emitted as `<link rel="stylesheet">` in `extraHead`
   ([server.ts, production global CSS](https://github.com/withl5e/l5e/blob/e788ca2/packages/core/src/core/server.ts#L323-L331)).

### Local reproduction

I ran the basic example in dev and inspected the loaded document:

- `/src/views/home/home.css` remained a stylesheet link in the head.
- `/src/global.css` appeared only after load as a Vite-generated
  `<style data-vite-dev-id=".../src/global.css">`.
- Once loaded, the computed global layout was `body` background
  `rgb(246, 247, 249)` and `.nav { display: flex }`.

A controlled reproduction can delay the `/src/global.css` request during a
full navigation. While it is delayed, the new document is observable with the
browser defaults (`body` margin `8px`, transparent background, `.nav` display
`block`); releasing the request restores the intended layout. This isolates the
failure from SSR latency and from per-view CSS.

## Why the browser behavior is expected

- Vite documents that importing a `.css` file injects its content into the page
  via a `<style>` tag and adds HMR support
  ([Vite CSS features](https://vite.dev/guide/features.html#css)).
- Module scripts are deferred automatically; their module graph must be fetched
  and processed before their CSS-import side effects occur
  ([MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_classic_scripts)).
- A parser-discovered `<link rel="stylesheet">` in the head is render-blocking
  by default. A stylesheet added dynamically by script is not render-blocking
  by default
  ([MDN `<link>` blocking behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#blocking)).

This explains the dev/prod difference: production gives the browser a critical
stylesheet link before first paint, while development waits for a JavaScript
side effect.

## Relationship to `PLAN-dedupe-dev-assets.md`

The plan addresses a real but separate issue: repeated `useCss()` or
`useClientJs()` calls used to generate duplicate tags in dev. Commit `88b51fd`
already normalizes and deduplicates those registries. The current source also
defensively deduplicates dev tags before serialization.

That fix cannot prevent this flash. Even exactly one `client.global.ts` script
still injects global CSS too late on every new document.

## Design options evaluated

The implemented choice is the `src/global.css` convention. It keeps one source
of truth without requiring matching options in both the Vite plugin and server.
Additional global files can be composed with ordered CSS `@import` rules.
`client.global.ts` is now reserved for global JavaScript.

### 1. Explicit configuration alternative

Change the framework contract so critical global CSS is emitted as a
parser-discovered `<link rel="stylesheet">` in `<head>` in both dev and
production. Keep `client.global.ts` for global JavaScript behavior, not for the
only copy of critical layout CSS.

A practical design is one of:

- an explicit `globalStyles` option/list in server or framework config; or
- a convention such as auto-detecting `src/global.css`, with additional global
  styles composed from it using CSS `@import`.

An explicit list supports multiple independent files and link metadata, but it
requires a build artifact to carry the plugin-only declaration into the
production server. The convention avoids that extra interface and artifact for
the current one-entry use case.

Important implementation requirements:

- Emit the links before the response is sent and inside `<head>`.
- Preserve declared order because CSS cascade order is observable.
- Normalize/dedupe URLs just as the per-view asset registry does.
- Do not also import the same CSS through `client.global.ts`; otherwise dev may
  apply it once as a link and again as an injected style, changing cascade
  behavior.
- Respect Vite `base` rather than hard-coding a root-relative URL.
- Keep HMR coverage. Vite treats CSS referenced by HTML `<link href>` as an HTML
  asset, and its docs state that CSS referenced from HTML participates in
  Vite's processing
  ([Vite HTML and project root](https://vite.dev/guide/#index-html-and-project-root)).

For the existing docs site, the four CSS imports in `client.global.ts` should
either become four ordered global-style entries or be composed from one global
CSS entry. The starter templates should move `global.css` to the new contract.

### 2. Short-term workaround for applications

Register the global stylesheet with `useCss('/src/global.css')` from a shared
root/layout component that renders for every page, and remove the matching CSS
import from `client.global.ts`. That reuses L5E's existing head-asset path in
development and its manifest/bundling path in production. If the application
does not have one shared render root, each top-level view must register it;
the registry already deduplicates repeated registrations within a request.

A static `<link href="/src/global.css">` in source `index.html` is useful as a
dev-only experiment, but is **not** a safe L5E production workaround today:
the production server reads the source template rather than Vite's rewritten
`dist/client/index.html`, and `/src/global.css` is not a production static URL
([server.ts production template](https://github.com/withl5e/l5e/blob/e788ca2/packages/core/src/core/server.ts#L431-L437)).
Changing the production template source could make the normal Vite HTML-link
pattern viable later ([Vite HTML features](https://vite.dev/guide/features.html#html)).

### 3. Possible fallback: render-block the global module script

Moving `client.global.ts` into the head and marking it
`blocking="render"` could prevent the first paint until its CSS side effects
finish. The platform documents render-blocking scripts/styles in the head
([MDN View Transition guidance](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using#stabilizing_page_state_to_make_cross-document_transitions_consistent)).

This is not the preferred framework fix:

- browser support for explicit script render blocking is newer than ordinary
  stylesheet links;
- all global JavaScript and its dependencies would delay paint in dev;
- it couples CSS correctness to JavaScript execution and failure;
- it does not make the dev asset model match production's head stylesheet
  model.

### Approaches that do not fix the root cause

- More asset deduplication: there is already only one relevant module script.
- Calling `transformIndexHtml()` again after SSR: it does not turn transitive
  CSS imports of `client.global.ts` into render-blocking stylesheet links.
- Preloading CSS without applying it: preload can reduce latency but does not
  make the stylesheet participate in rendering.
- Adding client-side navigation solely to hide the flash: it avoids document
  replacement but is a much larger routing/runtime change and leaves cold-load
  FOUC unresolved.
- View Transitions: these can mask document replacement, but critical CSS still
  needs to be ready for a stable transition.

## Verification plan for the eventual code change

1. Add a dev E2E test that intercepts/delays global CSS, performs a full anchor
   navigation, and asserts the new document never becomes observable with
   browser-default layout.
2. Assert the dev response contains each global stylesheet exactly once in the
   head and that `client.global.ts` remains exactly once.
3. Edit global CSS during the test and verify Vite HMR updates styles without a
   full reload.
4. Add production assertions that global CSS still maps through the manifest,
   is emitted once, and precedes body content.
5. Cover multiple ordered global styles, a non-root `base`, and an application
   with no `client.global.ts`.
6. Retain the current `asset-dedupe` tests; they guard a different regression.

## Primary references

- [Vite SSR middleware-mode integration](https://vite.dev/guide/ssr.html#setting-up-the-dev-server)
- [Vite backend integration](https://vite.dev/guide/backend-integration.html)
- [Vite CSS behavior](https://vite.dev/guide/features.html#css)
- [Vite HTML behavior](https://vite.dev/guide/features.html#html)
- [MDN: `<link>` render blocking](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#blocking)
- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_classic_scripts)
