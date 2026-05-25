# Router

L5E ships a small typed route table. Apps that outgrow a hand-written `if/else`
in `src/route.ts` can declare routes as a table, capture dynamic segments
automatically, and read them from loaders or components.

The route table is opt-in. The original `string | null` route handler keeps
working unchanged:

```ts
import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler(requestInfo: RequestInfo) {
  if (requestInfo.pathname === '/') return 'home';
  return null;
}
```

## defineRoutes

```ts
import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/blog/$slug', view: 'article' },
  { path: '/docs/$', view: 'docs' },
]);
```

`defineRoutes()` returns a function with the same shape as the original
handler. L5E loads `src/views/<view>/loader.ts` and `src/views/<view>/index.tsx`
exactly as before.

## Path syntax

| Pattern        | Matches                                  | Captures               |
| -------------- | ---------------------------------------- | ---------------------- |
| `/`            | only the root                            | —                      |
| `/about`       | exact `/about`                           | —                      |
| `/blog/$slug`  | one URL segment                          | `params.slug`          |
| `/docs/$`      | one or more trailing segments            | `params._splat`        |

Param names follow JavaScript identifier rules (`[A-Za-z_][A-Za-z0-9_]*`).
A splat (`$`) must be the final segment and matches at least one trailing
segment — so `/docs` does **not** match `/docs/$`. URL-encoded characters in
captured segments are decoded with `decodeURIComponent`.

## Matching priority

When multiple routes could match a URL, the more specific one wins. Routes are
sorted once at `defineRoutes()` construction; matching is then a linear scan in
priority order.

1. Root `/` first
2. Static segments beat dynamic at the same depth (`/docs/api` beats
   `/docs/$slug`)
3. Deeper paths beat shallower ones
4. Splat routes are tried last

```ts
export default defineRoutes([
  { path: '/docs/$', view: 'docs' },
  { path: '/docs/api', view: 'api-docs' },
]);
```

`/docs/api` always matches `api-docs`; declaration order does not matter.

## Reading params

In loaders:

```ts
import type { LoaderFunction } from '@withl5e/l5e/entry-server';

export const loader: LoaderFunction = async (requestInfo) => {
  const slug = requestInfo.params?.slug;
  return { props: { slug } };
};
```

In components:

```tsx
import { useRequest } from '@withl5e/l5e/jsx-runtime';

export default function Page() {
  const { params } = useRequest();
  return <div>{params.slug}</div>;
}
```

## params.parse

Run a validator on each match before the loader sees the params:

```ts
export default defineRoutes([
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

If `parse()` throws, the request fails with a `400 Bad Request` and renders
the `_error` view through L5E's normal error pipeline.

## params.schema (Zod)

`params.schema` accepts any object with a `parse(raw)` method. That matches `z.object(...)`,
so Zod works without the router importing it — Zod stays an optional app dependency.

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

`/posts/123` → loader sees `{ id: 123 }`. `/posts/abc` → `ZodError` is wrapped as `400 Bad
Request` and rendered through `_error`.

Yup, Valibot, ArkType — anything that matches `{ parse(raw): T }` works. When both `parse` and
`schema` are set on the same route, `parse` wins.

## Async resolve

Use `resolve()` when the path is just a matcher and the view is decided by an
API, CMS, or cached slug map:

```ts
import { defineRoutes } from '@withl5e/l5e/router';
import { RedirectException } from '@withl5e/l5e';

export default defineRoutes([
  { path: '/', view: 'home' },
  {
    path: '/$slug',
    async resolve({ params, requestInfo }) {
      const entry = await cms.findBySlug(params.slug);

      if (!entry) return null;
      if (entry.redirectTo) throw new RedirectException(entry.redirectTo, 301);

      return { view: entry.type, params: { slug: params.slug, id: entry.id } };
    },
  },
]);
```

`resolve()` receives `{ params, requestInfo }` and returns a view name, a
`{ view, params }` object, or `null`. Returning `null` from `resolve()` is
authoritative — the router does not fall through to lower-priority routes.

When both `view` and `resolve` are set on the same route, `resolve` wins.
`RedirectException` thrown inside `resolve` propagates unchanged; the router
does not catch it.

## Out of scope

Phase 1 deliberately does not support optional segments, prefix params
(`/files/prefix$name.txt`), nested layouts, file-based routing, typed link
generation, or a Zod-style `params.schema` adapter. File-based routing, when
added, will compile to the same `defineRoutes` table rather than introducing
a parallel matching path.
