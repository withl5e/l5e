---
title: Error pages
description: A single _error view renders 404 / 500 / anything in between. Throw an HttpException to short-circuit.
section: Routing & Navigation
order: 12
---

# Error pages

L5E ships one error path: any `HttpException` thrown from a middleware, a route handler,
a loader, or a component during render is caught by the framework and routed into the
`_error` view with `{ statusCode, message, data }` props. You don't write a separate
404 view and a separate 500 view — you write one, branch on `statusCode` inside it.

## The `_error` view

It's a regular view living at `src/views/_error/index.tsx`. Discovered automatically
by name, no registration.

```tsx
// src/views/_error/index.tsx
import { Fragment, useCss } from '@withl5e/l5e/jsx-runtime';
import { MetadataRenderer } from '@withl5e/l5e/seo';

export interface ErrorPageProps {
  statusCode: number;
  message: string;
  data?: Record<string, unknown>;
}

export default function ErrorPage({ statusCode, message, data }: ErrorPageProps) {
  useCss('/src/views/_error/styles.css');

  return (
    <Fragment>
      <main class="error-page">
        <p class="error-page__code">{statusCode}</p>
        <h1 class="error-page__title">{titleFor(statusCode)}</h1>
        <p class="error-page__message">{message}</p>

        {statusCode === 404 ? (
          <a class="error-page__cta" href="/">Back to home</a>
        ) : (
          <a class="error-page__cta" href="javascript:location.reload()">Try again</a>
        )}

        {process.env.NODE_ENV !== 'production' && data ? (
          <pre class="error-page__data">{JSON.stringify(data, null, 2)}</pre>
        ) : null}
      </main>
    </Fragment>
  );
}

function titleFor(code: number): string {
  if (code === 404) return 'Page not found';
  if (code === 500) return 'Something went wrong';
  if (code >= 500) return 'Service unavailable';
  if (code >= 400) return 'Bad request';
  return 'Error';
}
```

A few things to notice:

- It's a normal view — `useCss`, `useClientJs`, islands, and `MetadataRenderer` all work
  the same way as on any other view.
- Props carry just enough to render: a status code, a human-readable message, and an
  optional `data` bag. In production, hide `data` — it can contain debugging info you
  don't want to expose.
- One file handles every status code. Branch in the component, not in the routing.

### What happens without `_error`

If you skip the file, the framework returns a plain `<div>404 - Not Found</div>` body
with the right status code. Functional, ugly. Add the view as soon as you ship.

## Throwing exceptions

The framework exports a small set of HTTP exception classes from `@withl5e/l5e`. Each
just sets a `statusCode` and forwards the `message` + optional `data` payload.

```ts
import {
  HttpException,                 // base class — extend for custom statuses
  BadRequestException,           // 400
  NotFoundException,             // 404
  InternalServerErrorException,  // 500
  ServiceUnavailableException,   // 503
  RedirectException,             // 30x (not routed to _error — emits Location header)
} from '@withl5e/l5e';
```

Throw them wherever data validation fails:

```ts
// loader.ts
import { NotFoundException, ServiceUnavailableException } from '@withl5e/l5e';

export const loader: LoaderFunction = async ({ pathname }) => {
  const slug = pathname?.split('/').pop();
  if (!slug) throw new NotFoundException('Missing slug');

  let article;
  try {
    article = await db.articles.findUnique({ where: { slug } });
  } catch (err) {
    throw new ServiceUnavailableException('Database unavailable', {
      cause: String(err),
    });
  }

  if (!article) throw new NotFoundException(`Article ${slug} not found`);

  return { props: { article } };
};
```

You can attach a `data` object for the error view to surface in development:

```ts
throw new NotFoundException('Article not found', {
  slug,
  attemptedAt: new Date().toISOString(),
});
```

The `data` flows into `ErrorPageProps.data` — gate it behind `NODE_ENV !== 'production'`
when you render so it never leaks to public visitors.

## How L5E decides to render `_error`

Three doors lead to the error view:

1. **`route.ts` returns `null`.** The framework treats it as a 404 and renders `_error`
   with `statusCode: 404`. Useful for unknown paths without explicit throws.
2. **An exception bubbles up.** Anything that extends `HttpException` (or any other
   `Error` — those become 500) thrown from middleware, the route handler, a loader, or
   the component during render.
3. **A `RedirectException` is thrown.** This one *doesn't* render `_error`. The
   framework converts it into a 30x response with a `Location` header and never reaches
   the error view.

A loose call graph:

```
Request
  ├── middleware throws? ─────→ catch → render _error with status
  ├── route.ts returns null? ─→ catch → render _error with status=404
  ├── route.ts throws? ───────→ catch → render _error
  ├── loader throws? ─────────→ catch → render _error
  └── component throws? ──────→ catch → render _error

       (RedirectException at any layer ─→ 30x + Location header)
```

## Cache headers on errors

The `_error` view is rendered without going through a loader, so it has no opportunity
to set cache directives. The framework reflects that by emitting **no `Cache-Control`
header** on error responses — neither at the public nor private level. CDNs that respect
the missing header (most do) won't cache the page.

The baseline `Cache-Tag: global` header is still emitted (so a global purge invalidates
the error page along with everything else), but without `Cache-Control` the tag is
typically a no-op.

Practical consequences:

- **5xx responses never accumulate at the CDN** — useful, because a transient outage
  would otherwise poison the cache for the duration of `s-maxage`.
- **404 responses don't cache either.** For most sites that's fine. If you have a
  high-traffic 404 surface and want to absorb the load at the CDN, the only honest path
  is a `rawResponse` with `statusCode: 404` and explicit cache headers from a regular
  view's loader — not the `_error` view.

## Common pitfalls

- **Don't catch and re-throw exceptions.** Let `HttpException` bubble — the framework's
  catcher is the one routing it. A `try { … } catch { return null }` in your loader
  hides the real status code and breaks the error view.
- **Don't render `_error` from your own code.** Throw the exception instead. The
  framework owns the rendering path.
- **Don't put expensive work in `_error`.** The view runs for every 404 a crawler
  triggers. Keep it template-only — no DB calls, no API hits.
- **Don't redirect from `_error`.** Returning a 30x from inside the error view leaves
  the response with the original error status. If you need a redirect, throw
  `RedirectException` from the layer that detected the problem (route or loader).
