---
title: Routing
description: defineRoutes maps URLs to view names with dynamic params, optional groups and splats — backed by path-to-regexp.
section: Routing & Navigation
order: 6
---

# Routing

`src/route.ts` is one function: request in, view name out. For most apps the cleanest way to
write it is `defineRoutes()` — a typed route table backed by
[`path-to-regexp`](https://github.com/pillarjs/path-to-regexp).

```ts
// src/route.ts
import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/about', view: 'about' },
  { path: '/blog/:slug', view: 'article' },
  { path: '/cat/:slug{/page/:page}', view: 'category' },
  { path: '/docs/*path', view: 'docs' },
]);
```

| Pattern                       | Matches                                                  | Captures                                |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------- |
| `/`                           | only the root                                            | —                                       |
| `/about`                      | exact `/about`                                           | —                                       |
| `/blog/:slug`                 | one URL segment                                          | `params.slug` (string)                  |
| `/cat/:slug{/page/:page}`     | `/cat/x` and `/cat/x/page/2` (group is atomic)           | `params.slug`, optional `params.page`   |
| `/list/:cat{/:page}{/:size}`  | `/list/x`, `/list/x/2`, `/list/x/2/20` (ordered, atomic) | per-key strings                         |
| `/docs/*path`                 | one or more trailing segments                            | `params.path` (`string[]`)              |

Captures land on `requestInfo.params` and `useRequest().params`. All values are
`decodeURIComponent`-decoded.

## Path syntax

- `:name` → one segment, string
- `*name` → one-or-more trailing segments, `string[]`. Greedy; bare parent doesn't match (`/docs` does not match `/docs/*path`).
- `{...}` → atomic optional group. Multiple sibling `{...}{...}` are ordered.

## Optional groups

`{...}` is the only optional syntax (no per-segment `?`). Wrap a single optional param in `{}` too.

```ts
defineRoutes([
  { path: '/blog/:slug{/:page}', view: 'article' },              // trailing optional param
  { path: '/cat/:slug{/page/:page}', view: 'category' },         // static-prefixed optional
  { path: '/list/:cat{/:page}{/:size}', view: 'list' },          // ordered atomic groups
]);
```

Atomic: `/cat/laptops/page` does **not** match `/cat/:slug{/page/:page}` — the group needs
both pieces. Absent groups simply don't add their keys to `params`; default with `?? value`
in the loader.

## Matching priority

More specific wins. Sort happens once at construction, so declaration order is irrelevant.

1. Required-only routes beat group-bearing routes
2. Static segments beat dynamic at the same depth (`/docs/api` beats `/docs/:slug`)
3. Deeper required paths beat shallower
4. Splat (`*name`) routes are tried last

```ts
defineRoutes([
  { path: '/docs/*path', view: 'docs' },
  { path: '/docs/api', view: 'api-docs' },
]);
// /docs/api → 'api-docs'; /docs/intro/setup → 'docs'
```

## params.parse

Validate or coerce captured params before the loader sees them. Throwing turns into a
`400 Bad Request` rendered through `_error`.

```ts
defineRoutes([
  {
    path: '/posts/:id',
    view: 'post',
    params: {
      parse: ({ id }) => {
        if (!/^\d+$/.test(id as string)) throw new Error('id must be numeric');
        return { id: Number(id) };
      },
    },
  },
]);
```

## params.schema (Zod)

`params.schema` accepts anything with a `parse(raw)` method — `z.object(...)` fits without
the router importing Zod. Zod stays an optional app dep (`pnpm add zod`).

```ts
import { z } from 'zod';

defineRoutes([
  {
    path: '/posts/:id',
    view: 'post',
    params: {
      schema: z.object({ id: z.coerce.number().int().positive() }),
    },
  },
]);
```

`/posts/123` → `{ id: 123 }`. `/posts/abc` → `ZodError` becomes a 400. Yup, Valibot,
ArkType, or a hand-rolled `{ parse(raw): T }` all work. When both `parse` and `schema` are
set, `parse` wins.

## Reading route params

Captured values live on `requestInfo.params` and are exposed via `useRequest().params`. The
exact shape depends on whether the route declared `parse` / `schema`:

- **No `parse` / `schema`** — the loader sees the raw matcher output: `:name` → string,
  `*name` → `string[]`, optional-group keys absent when the group didn't match.
- **With `parse` / `schema`** — the loader sees whatever the validator returned. Coerce
  there once and every loader/component reads the post-validated shape; no re-coercion below.

```ts
// Raw shape — Route: { path: '/blog/:slug', view: 'article' }
export const loader: LoaderFunction = async (requestInfo) => {
  const slug = String(requestInfo.params?.slug);
  return { props: { slug } };
};
```

```ts
// Optional group — Route: { path: '/cat/:slug{/page/:page}', view: 'category' }
export const loader: LoaderFunction = async (requestInfo) => {
  const slug = String(requestInfo.params?.slug);
  const page = Number(requestInfo.params?.page ?? 1);  // default when group is absent
  return { props: { slug, page } };
};
```

```ts
// Splat as array — Route: { path: '/docs/*path', view: 'docs' }
export const loader: LoaderFunction = async (requestInfo) => {
  const segments = (requestInfo.params?.path ?? []) as string[];
  return { props: { path: segments.join('/'), segments } };
};
```

```ts
// Post-schema shape — Route uses { params: { schema: z.object({ id: z.coerce.number() }) } }
export const loader: LoaderFunction = async (requestInfo) => {
  const id = requestInfo.params?.id as number;   // already coerced by Zod
  return { props: { id } };
};
```

`requestInfo.params` is typed `Record<string, any> | undefined` — `undefined` only when the
route handler returned a bare view name string. For routes defined via `defineRoutes()` the
table guarantees the required keys you declared.

## Async resolve

When the view comes from an API, CMS, or cached slug map, use `resolve()` instead of `view`.
The router calls it after a successful path match.

```ts
import { defineRoutes } from '@withl5e/l5e/router';
import { RedirectException } from '@withl5e/l5e';

defineRoutes([
  { path: '/', view: 'home' },
  {
    path: '/:slug',
    async resolve({ params }) {
      const entry = await cms.findBySlug(params.slug as string);
      if (!entry) return null;
      if (entry.redirectTo) throw new RedirectException(entry.redirectTo, 301);
      return { view: entry.type, params: { slug: params.slug, id: entry.id } };
    },
  },
]);
```

`resolve()` returns a view name, `{ view, params }`, or `null`. `null` is authoritative —
the router does **not** fall through to lower-priority routes. `resolve` wins over `view`
when both are set. `RedirectException` propagates unchanged.

**Order:** `params.parse` / `params.schema` runs *before* `resolve()`, so `params` arrives
already validated. Declare a Zod schema and write `resolve` against the typed shape directly.

For high-traffic apps, cache the slug → entry lookup in module scope and refresh on a timer
or via a webhook so each request only does a `Map.get`.

### Pattern: article-or-category with pagination

A top-level slug that's either a single article or a paginated category index is one route
plus an optional group:

```ts
defineRoutes([
  { path: '/', view: 'home' },
  { path: '/about', view: 'about' },                  // static wins via specificity
  {
    path: '/:slug{/page/:page}',
    async resolve({ params }) {
      const slug = params.slug as string;
      const entry = await cms.findBySlug(slug);
      if (!entry) return null;

      if (entry.kind === 'article') {
        if (params.page) return null;                 // /:slug/page/N on article → 404
        return { view: 'article', params: { slug, id: entry.id } };
      }
      if (entry.kind === 'category') {
        return {
          view: 'category',
          params: { slug, page: Number(params.page ?? 1), id: entry.id },
        };
      }
      return null;
    },
  },
]);
```

Static routes still win because specificity puts required-only patterns first. The catch-all
is greedy — `return null` for anything the CMS doesn't have (or invalid shapes like
`/article-slug/page/2`).

## Redirects

Throw `RedirectException` from anywhere — routing, loader, middleware. The framework converts
it into a `30x` with a `Location` header.

```ts
import { RedirectException } from '@withl5e/l5e';

if (pathname === '/old-url') throw new RedirectException('/new-url', 301);
```

## Trailing-slash normalization

Handle in `src/global-loader.ts` so the rule applies uniformly:

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
  params?: Record<string, any>;      // strings from :name, string[] from *name
}
```

`locals` is the middleware bridge (see [[09-middleware]]). `params` is whatever the route
table extracted.

## Anti-patterns

- **Don't fetch view data inside `route.ts`.** Routing decides *which* view; the loader
  decides *what data*. Mixing them muddies caching and the 404 path.
- **Don't catch exceptions in the router.** Let `RedirectException` / `NotFoundException` /
  `InternalServerErrorException` propagate.
- **Don't keep slow synchronous work in the hot path.** Cache remote lookups in module scope
  and refresh on a timer; per-request DB hits dominate TTFB.

## Escape hatch: a plain function

`defineRoutes()` is a convenience. The contract is just a function — if your logic is small
or doesn't fit a table, write it directly:

```ts
import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler({ pathname }: RequestInfo): string | null {
  if (pathname === '/') return 'home';
  if (pathname?.startsWith('/blog/')) return 'article';
  return null;
}
```

Return a string, `null`, a `Promise` of either, or `{ view, params }` to populate
`requestInfo.params` from your own logic. Throw `RedirectException` to redirect.
