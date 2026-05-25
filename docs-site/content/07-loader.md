---
title: Loader
description: Fetch data, set cache headers, generate metadata — all from one file per view.
section: Routing & Navigation
order: 7
---

# Loader

A `loader.ts` next to `index.tsx` is where a view fetches its data, sets cache directives,
returns metadata, and short-circuits with errors or redirects. The file is fully optional — a
view without one renders with `{}` as props.

```ts
// src/views/article/loader.ts
import { NotFoundException } from '@withl5e/l5e';
import type {
  GenerateMetadataFunction,
  LoaderFunction,
  LoaderResult,
} from '@withl5e/l5e/entry-server';

export type ArticleLoaderData = {
  title: string;
  body: string;
  publishedAt: string;
};

export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  // From a `/blog/$slug` route in defineRoutes — see [[06-routing]].
  const slug = String(requestInfo.params?.slug);

  const article = await db.articles.findUnique({ where: { slug } });
  if (!article) throw new NotFoundException(`Article ${slug} not found`);

  return {
    props: {
      title: article.title,
      body: article.bodyHtml,
      publishedAt: article.publishedAt.toISOString(),
    } satisfies ArticleLoaderData,
    maxAge: 0,
    sMaxAge: 300,
    swr: 3600,
    cacheTags: ['articles', `article:${slug}`],
  };
};

export const generateMetadata: GenerateMetadataFunction = (_req, props) => ({
  title: (props as ArticleLoaderData).title,
  description: extractDescription((props as ArticleLoaderData).body),
});
```

## `LoaderResult` — every field, when to use it

```ts
interface LoaderResult {
  props?: Record<string, any>;
  lang?: string;                  // sets <html lang="…">
  maxAge?: number;                // Cache-Control: max-age
  sMaxAge?: number;               // Cache-Control: s-maxage
  swr?: number;                   // Cache-Control: stale-while-revalidate
  cacheTags?: string[] | Record<string, boolean>;
  rawResponse?: RawResponse;      // see Raw Response page
  rawHtml?: boolean;              // skip the default HTML template
}
```

- **`props`** — passed directly to the view component as props. Plain JSON-serializable values
  work best; framework converts dates with `.toISOString()` is the safe default.
- **`maxAge` / `sMaxAge` / `swr`** — only emitted as `Cache-Control` in production. Dev never
  caches.
- **`cacheTags`** — joined with `global` (from the framework) and hashed for delivery in the
  `Cache-Tag` header. See the SEO → Cache Tags page.
- **`lang`** — overrides the global loader's `lang`. Use when the view itself owns the locale
  decision.
- **`rawHtml`** — emits the JSX output as-is, without wrapping in `index.html`. Useful when a
  view *is* the document (rare; most teams prefer `rawResponse`).
- **`rawResponse`** — see [[08-raw-response]].

## Reading route params

When `src/route.ts` uses `defineRoutes()`, captured URL segments are on
`requestInfo.params` (see [[06-routing]]). Named params land at their declared key; a splat
lands at `_splat`.

```ts
// Route: { path: '/blog/$slug', view: 'article' }
export const loader: LoaderFunction = async (requestInfo) => {
  const slug = String(requestInfo.params?.slug);
  return { props: { slug } };
};
```

```ts
// Route: { path: `/docs/$`, view: 'docs' }
export const loader: LoaderFunction = async (requestInfo) => {
  const path = String(requestInfo.params?._splat);   // e.g. 'getting-started/install'
  const segments = path.split('/');                  // ['getting-started', 'install']
  return { props: { path, segments } };
};
```

`requestInfo.params` is typed `Record<string, any> | undefined` — `undefined` only when the
route handler returned a bare view name string instead of populating params. For routes
defined via `defineRoutes()` the table guarantees the keys you declared; coercing with
`String(...)` keeps the loader honest under strict TS without a runtime check.

If you need typed coercion or validation (e.g. numeric IDs, enum slugs), do it once in the
route table via `params.parse` or `params.schema` (Zod-compatible) so every loader sees the
post-validated shape — see the routing doc.

## Named exports beside `loader`

A loader file can export three optional siblings that the framework picks up automatically.
None of them require the `loader` function to exist.

```ts
export const loader: LoaderFunction = async () => { /* … */ };

// Metadata for <title>, <meta>, OpenGraph, Twitter, robots — see SEO → Metadata.
export const generateMetadata: GenerateMetadataFunction = (req, props) => ({ /* … */ });

// JSON-LD schema injected into <head>. Multi-schema arrays supported.
export const generateSchema: GenerateSchemaFunction = (req, props) => ({ /* … */ });
```

Each runs after the loader, with the loader's resolved `props` available — so SEO and schema
can derive directly from the data you just fetched.

## Control flow with exceptions

Loaders are async, but you almost never need a `try/catch` in the view. Throw the right
exception and the framework renders the right page.

```ts
import {
  NotFoundException,
  InternalServerErrorException,
  RedirectException,
} from '@withl5e/l5e';

if (!record) throw new NotFoundException('Not found', { slug });
if (record.movedTo) throw new RedirectException(record.movedTo, 301);
if (apiResponse.status >= 500) {
  throw new InternalServerErrorException('Upstream failed', { status: apiResponse.status });
}
```

`NotFoundException` and friends are caught by the framework and routed through the `_error`
view ([[05-views]]). The `data` you pass is available to that view for diagnostic display in
development.

## Global loader

`src/global-loader.ts` runs *before* every view's loader and contributes shared props,
metadata and cache tags.

```ts
// src/global-loader.ts
import type { LoaderFunction, GenerateMetadataFunction } from '@withl5e/l5e/entry-server';

export const loader: LoaderFunction = async (requestInfo) => ({
  lang: requestInfo.locals?.locale === 'en' ? 'en' : 'vi',
  props: {
    locale: requestInfo.locals?.locale ?? 'en',
    navigation: await loadNavigation(),
  },
  cacheTags: ['layout'],
});

// Skip the global loader for endpoints that don't need site chrome.
export function shouldIgnore(viewName: string): boolean {
  return ['robots', 'sitemap', 'feed'].includes(viewName);
}

export const generateMetadata: GenerateMetadataFunction = (req) => ({
  charset: 'utf-8',
  viewport: { width: 'device-width', initialScale: 1 },
  openGraph: { siteName: 'Acme', locale: 'en-US' },
});
```

**Merge order:** global props → view props (view wins). Metadata follows the same parent →
child merge. Cache tags are unioned.

## Parallelize work

Loaders are plain async functions — fan out, then await once.

```ts
export const loader: LoaderFunction = async (requestInfo) => {
  const [article, related, comments] = await Promise.all([
    db.articles.findUnique({ where: { slug } }),
    db.articles.findMany({ where: { tag: 'related' }, take: 5 }),
    db.comments.findMany({ where: { articleSlug: slug }, take: 50 }),
  ]);
  return { props: { article, related, comments }, sMaxAge: 60, swr: 300 };
};
```

Sequential awaits are the most common cause of slow TTFB — keep the fan-out tight.

## What a loader is *not*

- **Not a place for browser code.** Loaders run server-side only.
- **Not a place for view-specific UI logic.** Components handle that.
- **Not for rendering JSX.** Use the view's `index.tsx`. The single exception is `rawResponse`,
  which bypasses JSX entirely.
