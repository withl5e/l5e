---
title: Routing
description: src/route.ts maps URLs to view names — plain code, not a DSL.
section: Routing & Navigation
order: 6
---

# Routing

L5E routing is a single function in `src/route.ts`. It receives the request, returns a view
name (a folder under `src/views/`), and that's the contract.

```ts
// src/route.ts
import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler(requestInfo: RequestInfo): string | null {
  const { pathname } = requestInfo;
  if (pathname === '/') return 'home';
  if (pathname?.startsWith('/blog/')) return 'article';
  return null;
}
```

- Return a **string** → render `src/views/<string>/`.
- Return `null` → no view matched; the framework lets the next handler (or a 404) take over.
- Return a `Promise<string | null>` → routing can be async, hit a DB, or await CMS data.

There is no file-system convention, no `[...slug].tsx`, no nested `_layout` files. The function
is the routing.

## Common patterns

### Exact paths

```ts
if (pathname === '/') return 'home';
if (pathname === '/about') return 'about';
if (pathname === '/sitemap.xml') return 'sitemap';
if (pathname === '/robots.txt') return 'robots';
```

### Prefix routes

```ts
if (pathname?.startsWith('/blog/')) return 'article';
if (pathname?.startsWith('/u/')) return 'profile';
if (pathname?.startsWith('/tag/')) return 'tag';
```

The view's `loader.ts` reads the slug from `requestInfo.pathname` (or `requestInfo.url`) — the
router itself doesn't extract parameters.

### Segment shape

When the same prefix can mean different views, split and inspect:

```ts
if (pathname?.startsWith('/items/')) {
  const segment = pathname.slice('/items/'.length).split('/')[0] ?? '';
  const isObjectId = /^[a-f0-9]{24}$/.test(segment);
  return isObjectId ? 'item-detail' : 'item-list';
}
```

### Environment-gated views

```ts
if (pathname === '/swap-demo' && process.env.NODE_ENV === 'development') {
  return 'swap-demo';
}
```

The demo view never reaches a production build's routes — no flags, no dead code paths,
just an `if`.

### Async routing against a database / CMS

```ts
export default async function routeHandler({ pathname }: RequestInfo) {
  if (pathname === '/') return 'home';

  const slug = pathname?.split('/').filter(Boolean)[0];
  if (!slug) return null;

  const row = await db.slugs.findUnique({ where: { slug } });
  if (row?.redirect) throw new RedirectException(row.redirect, 301);
  if (row?.kind === 'post') return 'article';
  if (row?.kind === 'tag') return 'tag';
  return null;
}
```

For high-traffic apps, cache the slug → view mapping in module scope and refresh it on a timer
or via an invalidation webhook, so each request only does a `Map.get`.

### Redirects from the router

Throw `RedirectException` from anywhere — the router, a loader, or even a middleware. The
framework converts it into the appropriate `30x` response with a `Location` header.

```ts
import { RedirectException } from '@withl5e/l5e';

if (pathname === '/old-url') throw new RedirectException('/new-url', 301);
```

### Trailing-slash normalization

Best handled in `src/global-loader.ts` so the rule is applied uniformly before any view runs:

```ts
if (pathname && pathname !== '/' && pathname.endsWith('/')) {
  const target = new URL(requestInfo.url!);
  target.pathname = target.pathname.slice(0, -1);
  throw new RedirectException(target.toString(), 301);
}
```

## What `RequestInfo` carries

```ts
interface RequestInfo {
  url?: URL;
  pathname?: string;
  path?: string;            // includes querystring
  method?: string;
  headers?: Record<string, any>;
  cookies?: Record<string, string>;
  query?: Record<string, any>;
  ip?: string;
  locals?: Record<string, unknown>;  // populated by middleware
}
```

`locals` is the bridge from middleware to routing/loaders — see [[09-middleware]] for how
to put values there.

## Anti-patterns

- **Don't fetch view data inside `route.ts`.** Routing decides *which* view; the view's loader
  decides *what data*. Mixing them blocks `null` returns from going through the 404 path and
  makes caching murky.
- **Don't catch exceptions in the router.** Let `RedirectException` / `NotFoundException` /
  `InternalServerErrorException` propagate — the framework knows how to translate each into a
  response.
- **Don't keep slow synchronous work in the hot path.** If routing depends on remote data,
  cache the lookup table in module scope and refresh it on a timer; per-request DB hits will
  dominate your TTFB.
