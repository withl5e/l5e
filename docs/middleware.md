# Middleware

L5E middleware receives a Web `Request`, parsed URL data, cookies, locals and a `next()` function.
It can return a `Response`, modify response headers, or rewrite the request before render.

```ts
import { defineMiddleware, sequence } from '@l5e/core/middleware';

const rewriteDemo = defineMiddleware((context, next) => {
  if (context.url.pathname === '/rewrite-demo') {
    return next('/');
  }

  return next();
});

const headers = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('x-powered-by', 'L5E');
  return response;
});

export const onRequest = sequence(rewriteDemo, headers);
```

`next('/target')`, `next(new URL(...))` and `next(new Request(...))` all rewrite the downstream
request. Downstream middleware receives the updated `context.request`, `context.url`, cookies and
`context.requestInfo`.

Use `context.locals` for request-scoped data. Locals must stay JSON-serializable because L5E can
carry them through server render context.
