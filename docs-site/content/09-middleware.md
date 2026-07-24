---
title: Middleware
description: Wrap every request — rewrite paths, set headers, populate locals, gate access.
section: Routing & Navigation
order: 9
---

# Middleware

Middleware runs around every request, before and after the view renders. It's where you
rewrite URLs, attach values to `locals`, gate access, add response headers, or log.

```ts
// src/middleware.ts
import { defineMiddleware, sequence } from '@withl5e/l5e/middleware';

const rewriteLegacy = defineMiddleware((context, next) => {
  if (context.url.pathname === '/old-home') return next('/');
  return next();
});

const addPoweredBy = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('x-powered-by', 'L5E');
  return response;
});

export const onRequest = sequence(rewriteLegacy, addPoweredBy);
```

## Each middleware in one signature

```ts
type MiddlewareHandler = (
  context: MiddlewareContext,
  next: MiddlewareNext,
) => Response | Promise<Response>;
```

- Call `next()` to continue to the next middleware (or the view, if you're last).
- Call `next(path)` to **rewrite** the URL — downstream sees the new path.
- `await next()` returns the `Response` from downstream; you can mutate it before returning.
- Skip `next()` entirely and return your own `Response` to short-circuit.

## `MiddlewareContext`

```ts
interface MiddlewareContext {
  request: Request;                                   // standard Fetch Request
  requestInfo?: RequestInfo;                          // L5E's parsed view of it
  url: URL;                                           // request URL, parsed
  cookies: Record<string, string>;                    // parsed cookies
  locals: Record<string, unknown>;                    // mutable per-request bag
  redirect: (path: string | URL, status?: number) => Response;
  rewrite: (payload: string | URL | Request) => Promise<Response>;
  clientAddress: string;                              // throws if upstream didn't set it
}
```

- **`locals`** is the *only* sanctioned way to pass values from middleware to loaders. Mutate
  its properties; don't reassign it. Whatever you put there shows up as
  `requestInfo.locals.<key>` in `route.ts` and every loader.
- **`redirect(path, status)`** returns a `Response` directly — useful for permanent redirects
  (legacy URLs, region-specific homepages) and short-circuits that bypass the view entirely.
- **`rewrite(payload)`** lets downstream see a different URL without changing the address bar.
  `next(path)` is the shorthand most middlewares use.

## Common patterns

### Rewrite paths

```ts
const rewriteShortLinks = defineMiddleware((ctx, next) => {
  const shortLinks: Record<string, string> = { '/x': '/articles/launch' };
  const target = shortLinks[ctx.url.pathname];
  return target ? next(target) : next();
});
```

The browser keeps the original URL; the view that renders is the one matched by the *new*
path.

### Attach values to `locals`

```ts
const detectLocale = defineMiddleware((ctx, next) => {
  const accept = ctx.request.headers.get('accept-language') ?? '';
  ctx.locals.locale = accept.startsWith('vi') ? 'vi' : 'en';
  return next();
});
```

For real locale detection (URL prefixes, cookies, redirects), don't hand-roll this — bridge
in a library like Paraglide JS with `fromFetchMiddleware` instead. See [[27-i18n]].

Then in any loader:

```ts
export const loader: LoaderFunction = async ({ locals }) => {
  const messages = await loadMessages(locals?.locale as string);
  return { props: { messages }, lang: locals?.locale as string };
};
```

### Preview mode / edge geo

```ts
const detectCountry = defineMiddleware((ctx, next) => {
  // CDNs inject geo headers at the edge (Cloudflare's CF-IPCountry, Fastly's
  // X-Country-Code, etc.). Read it once here so loaders can branch on it.
  const country = ctx.request.headers.get('cf-ipcountry') ?? 'US';
  ctx.locals.country = country;
  return next();
});

const previewMode = defineMiddleware((ctx, next) => {
  // ?preview=<key> opts into draft/unpublished content for editors using a shared link.
  if (ctx.url.searchParams.get('preview') === process.env.PREVIEW_KEY) {
    ctx.locals.preview = true;
  }
  return next();
});
```

Returning a `Response` short-circuits the chain — `next()` is never called, no view renders.

### Response shaping

```ts
const securityHeaders = defineMiddleware(async (_ctx, next) => {
  const response = await next();
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return response;
});
```

Use middleware for headers that apply uniformly; use loaders for headers tied to a specific
response (cache headers, content type for raw responses).

### Logging / timing

```ts
const timing = defineMiddleware(async (ctx, next) => {
  const start = performance.now();
  const response = await next();
  const ms = (performance.now() - start).toFixed(1);
  response.headers.set('server-timing', `app;dur=${ms}`);
  return response;
});
```

## Composing the chain

```ts
export const onRequest = sequence(
  trailingSlashFix,
  detectLocale,
  detectCountry,
  previewMode,
  securityHeaders,
);
```

`sequence` runs handlers left-to-right on the way in and right-to-left on the way back out
(via the awaited `next()`). Order matters:

- Run rewrites **before** anything that reads `url.pathname` so downstream sees the final URL.
- Run `locals` population **before** loaders need to read them.
- Run response-mutation middlewares **outermost** so they wrap everything downstream.

## Middleware vs. global loader

Both run for every request — pick by *what kind of work* you're doing.

| Use middleware when | Use global loader when |
|---|---|
| You need the raw `Request` / `Response` | You need `props` available to the view |
| You're setting response headers | You're setting metadata / schema |
| You're populating `locals` | You're loading shared layout data |
| You're short-circuiting (redirect / 403) | You're contributing cache tags |
| You're rewriting the URL | You're choosing the document `lang` |

A typical app has both: middleware handles transport-level concerns (headers, locale and
geo detection, preview-mode toggle); the global loader handles render-level concerns
(navigation data, base metadata, cache tags).

## What middleware should not do

- **Don't fetch view-specific data.** That belongs in the view's loader.
- **Don't render JSX.** Middleware speaks `Request` / `Response`, not components.
- **Don't reassign `ctx.locals`.** Mutate its properties (`ctx.locals.locale = …`).
- **Don't swallow exceptions silently.** `RedirectException` and friends need to propagate;
  catching them defeats the framework's error routing.
