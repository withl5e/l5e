---
title: Tooltip
description: HTML-driven hover/focus tooltips, positioned by Floating UI, with content fetched from the server on demand.
section: Interactivity
order: 18
---

# Tooltip

A tooltip is a small HTML fragment, rendered by a normal view on the server, fetched and
positioned on demand when a visitor hovers (desktop) or taps (mobile) a trigger element.
The SSR HTML needs nothing but a few `data-*` attributes — no per-element JS, no client
framework, no bundle cost until a visitor actually triggers one.

```ts
// src/client.global.ts (or any client script — mount once)
import { initTooltips, setupTooltipObserver } from '@withl5e/l5e/tooltip';

initTooltips();
setupTooltipObserver(); // picks up tooltip triggers added later (e.g. by a React island)
```

```tsx
// anywhere in a view
<span data-tooltip-id="42" data-tooltip-type="word">
  hover me
</span>
```

`initTooltips()` finds every `[data-tooltip-id]` on the page once and wires up the right
event for the current device — `pointerenter` on desktop, `click` on mobile/touch (detected
via user agent + a `(max-width: 768px)` media query). The actual positioning/fetch logic
(`@floating-ui/dom`) is dynamically imported only when a trigger actually fires, so it
costs nothing on pages that have triggers nobody hovers.

## The fetch, and the route that serves it

A trigger's `data-tooltip-type` + `data-tooltip-id` become the fetch:
`GET /tooltip/:type/:id` (see [URL strategy](#url-strategy-configuretooltip) below to
change that). Give the app a matching route whose view renders **just the fragment** —
`rawHtml: true` skips the `index.html` shell, since the response goes straight into
`tip.innerHTML`, not a new page:

```ts
// src/route.ts
export default defineRoutes([
  // …
  { path: '/tooltip/:type/:id', view: 'tooltip' },
]);
```

```ts
// src/views/tooltip/loader.ts
export const loader: LoaderFunction = async (requestInfo) => {
  const { type, id } = requestInfo.params as { type: string; id: string };
  return { props: { type, id }, rawHtml: true };
};
```

```tsx
// src/views/tooltip/index.tsx
export default function TooltipFragment({ type, id }: { type: string; id: string }) {
  return <div class="tp-content">Whatever markup this tooltip needs.</div>;
}
```

This is a normal view — it can call a loader, hit a database, read `getLocale()`, whatever
the fragment needs. It's just never wrapped in the page shell.

## Data attributes

| Attribute | Required | Purpose |
|---|---|---|
| `data-tooltip-id` | Yes | Fed into the fetch URL as `:id`. Also what `initTooltips()` looks for to find triggers. |
| `data-tooltip-type` | No | Fed into the fetch URL as `:type` — lets one route serve several kinds of tooltip content. |
| `data-tooltip-placement` | No | A Floating UI `Placement` (`"top"`, `"bottom-start"`, …). Defaults to `"left"`. Falls back automatically (`flip`) if there's no room. |
| `data-href` | No | Mobile popup only — if set, adds a "Xem chi tiết" (view details) link to the given URL. |

## Desktop vs. mobile

- **Desktop**: hovering shows a small positioned tooltip (`.tp`) next to the trigger,
  auto-repositioning on scroll/resize (`autoUpdate`), and hides on `pointerleave`. If the
  content would take up more than 60% of the viewport height, it centers vertically and
  scrolls instead of overflowing.
- **Mobile/touch**: tapping opens a fullscreen popup (`.tp-overlay` / `.tp-mobile`) with a
  close button, dismissible by tapping outside it. No positioning math needed — it's not
  anchored to the trigger.

Both variants render `<div class="tp-loading">Loading...</div>` while the fetch is in
flight and `<div class="tp-error">Không thể tải tooltip</div>` if it fails. L5E ships no
CSS for any of these classes (`.tp`, `.tp-loading`, `.tp-error`, `.tp-overlay`,
`.tp-mobile`, `.tp-mobile-close`, `.tp-mobile-content`, `.tp-mobile-link`) — style them
yourself, e.g. via `useCss()` in whatever view renders the triggers.

## Dynamic content: `setupTooltipObserver()`

`initTooltips()` only scans the DOM once, when called. If tooltip triggers can appear
later — a React island rendering more of them client-side, an infinite-scroll list —
call `setupTooltipObserver()` too. It sets up one `MutationObserver` (guarded so calling
it twice is a no-op) that watches for newly-added `[data-tooltip-id]` elements and runs
`initTooltips()` again automatically when it sees one. Both together, once, is the normal
setup:

```ts
import { initTooltips, setupTooltipObserver } from '@withl5e/l5e/tooltip';

initTooltips();
setupTooltipObserver();
```

## URL strategy: `configureTooltip()`

The default fetch is `/tooltip/:type/:id` — no configuration, unchanged behavior. L5E
isn't an i18n framework and most apps using tooltips don't need anything else. But some
do — most commonly, a multi-language app that wants each locale's tooltip response to be
a distinct, CDN-cacheable URL instead of one URL that varies by cookie (most CDNs can't
cache that correctly). `configureTooltip()` replaces how the fetch URL is built for the
**whole app**, called once at startup:

```ts
// src/client.global.ts
import { configureTooltip } from '@withl5e/l5e/tooltip';

configureTooltip('auto-locale');
```

`'auto-locale'` infers a prefix from `<html lang>` matching the current URL's leading path
segment — `<html lang="vi">` on `/vi/...` fetches `/vi/tooltip/:type/:id`; an unprefixed,
base-locale page fetches the plain, unprefixed URL. See [[27-i18n]] for the full locale
setup this plugs into.

For anything else — a different API path, query params instead of path segments, whatever
— pass a function instead:

```ts
import { configureTooltip } from '@withl5e/l5e/tooltip';
import type { TooltipUrlContext } from '@withl5e/l5e/tooltip';

configureTooltip(({ type, id }: TooltipUrlContext) => `/api/v2/tooltips/${type}-${id}`);
```

`TooltipUrlContext` is `{ type, id, host }` — `host` is the trigger element itself, in
case the URL needs something else from its dataset.

**Call `configureTooltip()` from `client.global.ts`, not a per-view client script.** L5E's
per-request bundler compiles each view's client entry independently — a view that imports
`initTooltips()`/`showTooltip()` gets its own bundle with its own copy of the tooltip
module. Calling `configureTooltip()` from one view's script wouldn't be seen by a tooltip
triggered from a different view. `client.global.ts` is the one script guaranteed to run on
every page, so it's the only reliable place to configure something app-wide like this.

## What tooltip is not

- Not for content that should be indexable or linkable on its own — it's fetched
  on-demand HTML, invisible to a page's initial render and to crawlers that don't execute
  the hover/tap interaction.
- Not a general-purpose data-fetching primitive — for a button that fetches and swaps
  content into the page on click, reach for [[19-swap-and-action]] instead.
- Not styled out of the box — bring your own CSS for the `.tp*` class hooks.
