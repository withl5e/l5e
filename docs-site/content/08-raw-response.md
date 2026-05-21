---
title: Raw Response
description: Bypass JSX entirely — emit XML, JSON, plain text, or binary bytes directly.
section: Routing & Navigation
order: 8
---

# Raw Response

Sometimes a route shouldn't render JSX at all. Sitemaps, RSS feeds, `robots.txt`, JSON
endpoints, file downloads — they need a specific content type and a body the framework
shouldn't wrap in HTML.

A loader returns `{ rawResponse }` and the entire render pipeline is skipped. The view's
`index.tsx` is not executed. Cache headers from the same `LoaderResult` still apply.

```ts
// src/views/sitemap/loader.ts
import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

export const loader: LoaderFunction = async (): Promise<LoaderResult> => {
  const urls = await db.pages.findMany({ where: { indexed: true } });
  const xml = renderSitemapXml(urls);

  return {
    rawResponse: {
      body: xml,
      contentType: 'application/xml',
      statusCode: 200,
    },
    sMaxAge: 3600,
    swr: 86400,
    cacheTags: ['sitemap'],
  };
};
```

## Shape

```ts
interface RawResponse {
  body: string | Buffer;
  contentType: string;
  statusCode?: number;                  // default 200
  headers?: Record<string, string>;     // extra headers (added after framework defaults)
}
```

- **`body`** can be a string (XML/JSON/text) or a `Buffer` (PDFs, images, anything binary).
- **`contentType`** is required — it sets the response `Content-Type`. Get it wrong and
  browsers will sniff or refuse.
- **`statusCode`** defaults to `200`. Use `404` for "no robots.txt configured", `503` for
  maintenance pages, etc.
- **`headers`** is for response-specific extras. The framework still sets `Cache-Control` /
  `Cache-Tag` from your loader; don't duplicate them here.

## Practical patterns

### `robots.txt`

```ts
// src/views/robots/loader.ts
export const loader: LoaderFunction = async () => {
  const body = `User-agent: *
Allow: /
Sitemap: ${process.env.PUBLIC_URL}/sitemap.xml`;

  return {
    rawResponse: { body, contentType: 'text/plain', statusCode: 200 },
    sMaxAge: 3600,
    cacheTags: ['robots'],
  };
};
```

### `sitemap.xml`

Build the XML with whatever library you like (`sitemap`, `xmlbuilder2`, or hand-roll).

```ts
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'node:stream';

const stream = new SitemapStream({ hostname: process.env.PUBLIC_URL });
const data = await streamToPromise(Readable.from(entries).pipe(stream));

return {
  rawResponse: { body: data.toString(), contentType: 'application/xml' },
  sMaxAge: 3600,
  swr: 86400,
};
```

### RSS / Atom feed

```ts
import { Feed } from 'feed';

const feed = new Feed({ /* … */ });
posts.forEach((p) => feed.addItem({ title: p.title, link: p.url, date: p.publishedAt }));

return {
  rawResponse: { body: feed.rss2(), contentType: 'application/rss+xml' },
  sMaxAge: 600,
};
```

### JSON endpoint

```ts
return {
  rawResponse: {
    body: JSON.stringify({ items, total }),
    contentType: 'application/json',
  },
  sMaxAge: 60,
  swr: 300,
};
```

For mutating endpoints, prefer [[16-swap-and-action]] (`defineAction`) — actions are aware of
request bodies, methods, and the swap protocol.

### File download

```ts
const pdf = await renderInvoicePdf(invoiceId);   // returns Buffer

return {
  rawResponse: {
    body: pdf,
    contentType: 'application/pdf',
    headers: {
      'Content-Disposition': `attachment; filename="invoice-${invoiceId}.pdf"`,
    },
  },
};
```

## Pair with the global loader

Endpoints that emit XML/JSON usually don't want site chrome metadata or layout data attached.
Skip the global loader for them:

```ts
// src/global-loader.ts
export function shouldIgnore(viewName: string): boolean {
  return ['robots', 'sitemap', 'feed', 'api-items'].includes(viewName);
}
```

That keeps the global loader fast for HTML pages and stops it from doing pointless work for
machine-readable endpoints.

## When to choose `rawResponse` vs. `rawHtml`

| You want… | Use |
|---|---|
| Non-HTML body (XML, JSON, text, binary) | `rawResponse` |
| HTML but without the `index.html` shell | `rawHtml: true` (loader still returns `props`, view still renders) |
| HTML inside the normal shell | regular view + loader |

`rawHtml` is rare. Reach for it only when you need full control over the document — e.g.
generating an `oembed` HTML snippet. Most teams reach for `rawResponse` first.

## Edge cases

- **Don't set `Content-Type` in `headers`** — it'll fight `contentType`. Set it via
  `contentType` only.
- **Don't return a `Promise<Buffer>` directly.** Resolve it first and put the `Buffer` in
  `body`.
- **Caching applies the same way.** A 404 `rawResponse` still inherits the loader's cache
  headers — set `maxAge: 0, sMaxAge: 0` if you don't want negative responses cached.
