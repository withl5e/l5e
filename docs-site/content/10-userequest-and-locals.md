---
title: useRequest & locals
description: Read the per-request context inside any component; share values from middleware to loaders to JSX via locals.
section: Routing & Navigation
order: 10
---

# useRequest & locals

`useRequest` is how a component reads the current request without prop-drilling. `locals` is
the mutable bag attached to that request — populated by middleware, read by routing, loaders
and components. Together they're the spine of cross-cutting concerns for public sites:
locale, country, preview-mode flag, experiment buckets, anything that's "global to this
request, per-request, no globals."

```ts
import { useRequest } from '@withl5e/l5e/jsx-runtime';
```

## `useRequest` return shape

```ts
const {
  request,        // RequestInfo (url, pathname, method, headers, query, ip, locals)
  view,           // string | undefined — the view name returned by route.ts
  locals,         // shortcut to request.locals — typed as Record<string, unknown>
  addCacheTag,    // (tag) => void — add a cache tag for this response
  getCacheTags,   // () => string[] — read tags accumulated so far
} = useRequest();
```

`useRequest` reads from an `AsyncLocalStorage` set up at the start of the render. It must be
called **inside a component being rendered** — calling it at module scope or from a `setTimeout`
callback will throw.

## A minimal example

```tsx
import { useRequest } from '@withl5e/l5e/jsx-runtime';

export function LanguageBadge() {
  const { locals } = useRequest();
  const locale = (locals.locale as string | undefined) ?? 'en';

  return (
    <span class="lang-badge" data-locale={locale}>
      {locale === 'vi' ? 'Tiếng Việt' : 'English'}
    </span>
  );
}
```

The component has no props, no state, no prop-drilling. It pulls one value out of the
request's `locals` bag — a value some middleware put there earlier in the same request.

## The `locals` lifecycle

`locals` is a single object per request. Different layers can write and read it; the order
matters.

```
┌──────────────────────┐
│   1. Middleware      │  ctx.locals.locale = 'vi'
│   (writes)           │  ctx.locals.country = 'VN'
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   2. route.ts        │  requestInfo.locals.country — readable here
│   (reads)            │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   3. Loaders         │  requestInfo.locals.locale — readable, can also mutate
│   (read; may mutate) │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   4. Components      │  useRequest().locals — read here
│   (read via hook)    │
└──────────────────────┘
```

### Writing from middleware

```ts
// src/middleware.ts
import { defineMiddleware, sequence } from '@withl5e/l5e/middleware';

const detectLocale = defineMiddleware((ctx, next) => {
  const accept = ctx.request.headers.get('accept-language') ?? '';
  ctx.locals.locale = accept.startsWith('vi') ? 'vi' : 'en';
  return next();
});

const detectCountry = defineMiddleware((ctx, next) => {
  // CDN edges inject the country code as a header (Cloudflare's CF-IPCountry,
  // Fastly's X-Country-Code, etc.). Read once, expose to all downstream layers.
  ctx.locals.country = ctx.request.headers.get('cf-ipcountry') ?? 'US';
  return next();
});

const previewMode = defineMiddleware((ctx, next) => {
  if (ctx.url.searchParams.get('preview') === process.env.PREVIEW_KEY) {
    ctx.locals.preview = true;
  }
  return next();
});

export const onRequest = sequence(detectLocale, detectCountry, previewMode);
```

Middleware mutates `ctx.locals` properties — **never reassigns** the bag. The framework
forwards the same object through to `requestInfo.locals`.

### Reading from routing

```ts
// src/route.ts
export default function routeHandler({ pathname, locals }: RequestInfo) {
  // Country-specific homepage redirect — only fires when the visitor hits the
  // bare root. Real apps would also honor a "?stay=1" override to avoid loops.
  if (pathname === '/' && locals?.country === 'VN') {
    throw new RedirectException('/vi', 302);
  }
  // Preview pages only resolve when the preview gate flipped the flag in middleware.
  if (pathname?.startsWith('/preview/') && !locals?.preview) {
    return null;
  }
  // …
}
```

### Reading and mutating from loaders

Loaders can both read what middleware set and add more values for components to use.

```ts
// src/global-loader.ts
import { getGitHubStars } from '~/shared/github-stars';

export const loader: LoaderFunction = async (requestInfo) => {
  // read what middleware wrote
  const locale = (requestInfo.locals?.locale as string) ?? 'en';

  // add something for components downstream
  if (!requestInfo.locals) requestInfo.locals = {};
  (requestInfo.locals as Record<string, unknown>).githubStars = await getGitHubStars();

  return {
    lang: locale,
    props: { locale },
  };
};
```

The pattern of writing to `locals` from a loader is most useful in `global-loader.ts`, where
the value is something every view (and every component inside any view) might want — a real
example is fetching the GitHub star count once per request and exposing it to the top-bar
component.

### Reading from a component

```tsx
import { useRequest } from '@withl5e/l5e/jsx-runtime';

export function StarBadge() {
  const { locals } = useRequest();
  const stars = locals.githubStars as number | null | undefined;
  if (stars == null) return null;
  return <span class="star-badge">★ {stars}</span>;
}
```

No prop drilling from page → layout → header → badge. The badge reads directly from the
request context the loader populated.

## Practical patterns

### Active-state from the URL

```tsx
function NavLink({ href, children }) {
  const { request } = useRequest();
  const isActive = request.pathname === href;
  return (
    <a href={href} aria-current={isActive ? 'page' : undefined}>
      {children}
    </a>
  );
}
```

### Branch on the current view

```tsx
function Layout({ children }) {
  const { view } = useRequest();
  return (
    <body data-view={view}>
      {view === 'home' ? <HeroBanner /> : null}
      {children}
    </body>
  );
}
```

### Add a per-component cache tag

```tsx
function CommentList({ articleId }) {
  const { addCacheTag } = useRequest();
  addCacheTag(`comments:${articleId}`);
  // …render
}
```

The tag bubbles into the response `Cache-Tag` header — see [[23-cache-tags]].

### Preview banner

```tsx
function PreviewBanner() {
  const { locals } = useRequest();
  if (!locals.preview) return null;
  return (
    <div class="banner banner--preview" role="status">
      Preview mode — viewing unpublished content.
      <a href={typeof location !== 'undefined' ? location.pathname : '/'}>Exit preview</a>
    </div>
  );
}
```

### Server-side experiment buckets

```tsx
function HeroVariant() {
  const { locals } = useRequest();
  const bucket = (locals.experiment as string | undefined) ?? 'a';
  return bucket === 'b' ? <HeroB /> : <HeroA />;
}
```

Middleware does a stable hash of the request IP (or another input you control) into a bucket
once per request; every component that needs the assignment reads `locals.experiment`.

### Region-aware copy

```tsx
function HelloRegion() {
  const { locals } = useRequest();
  const country = (locals.country as string | undefined) ?? 'US';
  return <p>Hello from {country}!</p>;
}
```

The country comes from the CDN edge header, parsed once in middleware, then used anywhere.

## Typing `locals`

`locals` is typed as `Record<string, unknown>` — intentionally loose because the framework
can't know what middleware will put in. The recommended pattern is to declare a single
project-wide type and cast at the read site:

```ts
// src/types/locals.d.ts
export interface AppLocals {
  locale: 'en' | 'vi';
  country?: string;
  preview?: boolean;
  experiment?: 'a' | 'b';
  flags?: Set<string>;
  githubStars?: number | null;
}
```

```tsx
import type { AppLocals } from '~/types/locals';

const { locals } = useRequest();
const country = (locals as AppLocals).country;
```

A tighter alternative: a small helper that does the cast in one place.

```ts
// src/shared/useAppRequest.ts
import { useRequest } from '@withl5e/l5e/jsx-runtime';
import type { AppLocals } from '~/types/locals';

export function useAppRequest() {
  const ctx = useRequest();
  return { ...ctx, locals: ctx.locals as AppLocals };
}
```

## Important rules

- **`useRequest` must be called inside a component being rendered.** Calling it at module
  scope or from a deferred callback throws because the AsyncLocalStorage context isn't set
  there.
- **Don't reassign `locals`.** Mutate its properties (`ctx.locals.foo = bar`). Reassigning
  doesn't propagate to other layers.
- **Treat `locals` as read-only inside components.** Middleware and loaders own the writes;
  the JSX layer should only read.
- **`locals` is per-request.** Don't store anything that should outlive a single response in
  there — use module-scoped state or a real cache.
- **There is no `useState`.** `useRequest` is a context accessor, not a state cell. The same
  function runs once per request and returns once.

## What `useRequest` is *not*

- Not a place for browser state — that's `useClientJs` or an island.
- Not a side-effect hook — components are synchronous; `useEffect`-style work doesn't apply.
- Not a way to make a component reactive — there is no re-render in SSR.
- Not a substitute for a backend session or user store — L5E is built for public,
  cacheable pages. If you need per-user state, do it at the CDN/edge layer with explicit
  query/header inputs, not via cookies inside `useRequest`.
