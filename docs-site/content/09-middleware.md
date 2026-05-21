---
title: Middleware
description: Wrap every request with rewrites, headers, auth.
section: Routing & Navigation
order: 9
---

# Middleware

- `src/middleware.ts` exports `onRequest = sequence(...mws)` — runs in order.
- Each middleware: `(context, next) => Response`; call `next(newPath)` to rewrite.
- After `await next()` you can mutate the outgoing `Response` (e.g. add headers).
