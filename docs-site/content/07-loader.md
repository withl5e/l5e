---
title: Loader
description: Fetch data, set cache, throw 404s — all server-side.
section: Routing & Navigation
order: 7
---

# Loader

- Optional `loader.ts` next to `index.tsx`; exports `loader: LoaderFunction`.
- Return shape: `{ props, maxAge, sMaxAge, swr, cacheTags, lang, rawHtml }`.
- Throw `NotFoundException` / `InternalServerErrorException` for short-circuit errors.
