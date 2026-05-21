---
title: Views
description: A view is a folder under src/views — the unit of rendering in L5E.
section: Routing & Navigation
order: 5
---

# Views

A **view** is the unit of rendering in L5E. It lives as a folder under `src/views/<view-name>/`
and is composed of the small set of files the framework knows how to discover. There is no
central registry — adding a new folder is enough.

## The minimum

```text
src/views/article/
├── index.tsx        ← required: default export = page component
├── loader.ts        ← optional: data + cache + metadata
├── actions.tsx      ← optional: defineAction(...) handlers
├── client.ts        ← optional: useClientJs target
└── article.css      ← optional: useCss('/src/views/article/article.css')
```

`index.tsx` must `export default` a component. Everything else is opt-in.

```tsx
// src/views/article/index.tsx
import { Fragment, useCss } from '@withl5e/l5e/jsx-runtime';
import type { ArticleLoaderData } from './loader';

export default function ArticlePage({ title, body }: ArticleLoaderData) {
  useCss('/src/views/article/article.css');
  return (
    <Fragment>
      <h1>{title}</h1>
      <article setHtml={body} />
    </Fragment>
  );
}
```

## How a view becomes a response

1. `src/route.ts` returns the view name for the current pathname (`'article'`).
2. The optional `loader.ts` runs, producing `props` and cache directives.
3. `index.tsx` is rendered with those props inside the per-request render context.
4. Any `useCss` / `useClientJs` / island call registers into the context.
5. The framework bundles registered assets at runtime and returns the HTML.

Steps 2–5 only touch files that belong to *this* view — that is why bundle size scales with
what rendered.

## Conventions you can rely on

- **Filename = identity**: the folder name is the view name returned by `route.ts`. No exports,
  no enums.
- **Co-located everything**: a view's data fetching, JSX, client script and CSS sit in the same
  folder. Move the folder, you move the feature.
- **Per-view client entry**: `client.ts` is only loaded when this view is the one rendered for
  the request. Other views' scripts never reach the browser.

## Special views

A handful of view names carry meaning to the framework. Define them at the same level as your
regular views.

| Name | Triggered by | Purpose |
|---|---|---|
| `_error` | Any uncaught `HttpException` | Renders the error page with `{ statusCode, message, data }` props. Falls back to a plain "`<status> - <message>`" if the view is absent. |

You can also reserve names for protocol-style endpoints — `sitemap`, `robots`, `feed` — and
have their loaders return a `rawResponse` (see [[08-raw-response]]).

## What a view does *not* own

- **Routing decisions** — those live in `src/route.ts` ([[06-routing]]).
- **Cross-request middleware** — that lives in `src/middleware.ts` ([[09-middleware]]).
- **Global props or layout data** — those come from `src/global-loader.ts`, merged into the
  view's loader props.

A view's job is: take props, render JSX, register assets. Everything else is upstream of it.
