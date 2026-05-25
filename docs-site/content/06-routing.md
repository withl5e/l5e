---
title: Routing
description: defineRoutes maps URLs to view names with dynamic params, splats and async resolve — backed by the same simple route handler contract.
section: Routing & Navigation
order: 6
---

# Routing

L5E routing is a single function in `src/route.ts`. It receives the request, returns a view
name (a folder under `src/views/`), and that's the contract. For most apps the cleanest way
to author that function is `defineRoutes()` — a typed route table that handles dynamic
segments, splats and parsed params without leaving the framework.

```ts
// src/route.ts
import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/about', view: 'about' },
  { path: '/blog/$slug', view: 'article' },
  { path: `/docs/$`, view: 'docs' },
]);
```

| Pattern        | Matches                                  | Captures               |
| -------------- | ---------------------------------------- | ---------------------- |
| `/`            | only the root                            | —                      |
| `/about`       | exact `/about`                           | —                      |
| `/blog/$slug`  | one URL segment                          | `params.slug`          |
| `/docs/$`      | one or more trailing segments            | `params._splat`        |

Captured values land on `requestInfo.params` and are also exposed by `useRequest().params`.
Each value is `decodeURIComponent`-decoded; `/blog/hello%20world` yields `slug = 'hello world'`.

```ts
// src/views/article/loader.ts
export const loader: LoaderFunction = async (requestInfo) => {
  const slug = requestInfo.params?.slug;
  return { props: { slug } };
};
```

```tsx
// src/views/article/index.tsx
import { useRequest } from '@withl5e/l5e/jsx-runtime';

export default function Article({ slug }) {
  const { params } = useRequest();
  return <article data-slug={params.slug}>{slug}</article>;
}
```

## Matching priority

When more than one route could match, the more specific one wins. Sort happens once at
construction; matching is a linear scan in priority order, so declaration order is irrelevant.

1. Root `/` first
2. Static segments beat dynamic at the same depth (`/docs/api` beats `/docs/$slug`)
3. Deeper paths beat shallower ones
4. Splat routes are tried last

```ts
defineRoutes([
  { path: `/docs/$`, view: 'docs' },
  { path: '/docs/api', view: 'api-docs' },
]);
// /docs/api → 'api-docs'; /docs/intro/setup → 'docs'
```

## params.parse

Run a validator on each match before the loader sees the params. Throwing turns into a
`400 Bad Request` rendered through the `_error` view, so this is the right place for type
coercion and shape checks.

```ts
defineRoutes([
  {
    path: '/posts/$id',
    view: 'post',
    params: {
      parse: ({ id }) => {
        if (!/^\d+$/.test(id)) throw new Error('id must be numeric');
        return { id: Number(id) };
      },
    },
  },
]);
```

## params.schema (Zod)

`params.schema` accepts any object with a `parse(raw)` method that returns the typed shape —
that's exactly the shape of `z.object(...)`, so Zod works without the router importing it.
Zod stays an optional app dependency.

```sh
pnpm add zod
```

```ts
import { z } from 'zod';
import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  {
    path: '/posts/$id',
    view: 'post',
    params: {
      schema: z.object({
        id: z.coerce.number().int().positive(),
      }),
    },
  },
]);
```

For `/posts/123` the loader sees `requestInfo.params = { id: 123 }` — coerced and validated.
For `/posts/abc` the schema throws a `ZodError`, which the router wraps as `400 Bad Request`
through the `_error` view (same path as `params.parse`).

Any validator-style library with a compatible signature works — Yup, Valibot, ArkType — or
roll your own:

```ts
const idSchema = {
  parse: (raw: Record<string, string>) => {
    if (!/^\d+$/.test(raw.id)) throw new Error('id must be numeric');
    return { id: Number(raw.id) };
  },
};
```

When both `parse` and `schema` are set on the same route, `parse` wins — it's the most
explicit escape hatch.

## Async resolve

When the path is just a matcher and the view (or even the view's identity) comes from an API,
CMS, or cached slug map, use `resolve()` instead of `view`. The router calls it after a
successful path match and uses its return value as the routing result.

```ts
import { defineRoutes } from '@withl5e/l5e/router';
import { RedirectException } from '@withl5e/l5e';

export default defineRoutes([
  { path: '/', view: 'home' },
  {
    path: '/$slug',
    async resolve({ params }) {
      const entry = await cms.findBySlug(params.slug);
      if (!entry) return null;
      if (entry.redirectTo) throw new RedirectException(entry.redirectTo, 301);
      return { view: entry.type, params: { slug: params.slug, id: entry.id } };
    },
  },
]);
```

`resolve()` receives `{ params, requestInfo }` and returns a view name, a `{ view, params }`
object, or `null`. Returning `null` from `resolve()` is authoritative — the router does
**not** fall through to lower-priority routes after a path match. When both `view` and
`resolve` are set, `resolve` wins. `RedirectException` thrown inside `resolve` propagates
unchanged.

For high-traffic apps, cache the slug → entry lookup in module scope and refresh on a timer
or via an invalidation webhook, so each request only does a `Map.get`.

## Redirects

Throw `RedirectException` from anywhere — routing, a loader, even a middleware. The
framework converts it into the appropriate `30x` response with a `Location` header.

```ts
import { RedirectException } from '@withl5e/l5e';

if (pathname === '/old-url') throw new RedirectException('/new-url', 301);
```

## Trailing-slash normalization

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
  params?: Record<string, any>;      // populated by defineRoutes (or your own handler)
}
```

`locals` is the bridge from middleware to routing/loaders — see [[09-middleware]] for how to
put values there. `params` is whatever the route table extracted from the URL.

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

## Escape hatch: a plain function

`defineRoutes()` is a convenience. The underlying contract is just a function — if your
routing logic is small, gnarly, or doesn't fit a table, write one yourself.

```ts
// src/route.ts
import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler({ pathname }: RequestInfo): string | null {
  if (pathname === '/') return 'home';
  if (pathname?.startsWith('/blog/')) return 'article';
  return null;
}
```

Return a string to render `src/views/<string>/`, `null` for "not matched" (the framework
takes the 404 path), or a `Promise` of either to do async work. Throw `RedirectException` to
redirect. The handler can also return `{ view, params }` directly if you want to populate
`requestInfo.params` from your own logic without going through `defineRoutes`.
