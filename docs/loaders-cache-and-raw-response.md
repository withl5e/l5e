# Loaders, Cache And Raw Responses

A view can export a loader that returns props and cache policy.

```ts
import type { LoaderFunction } from '@withl5e/l5e/entry-server';

export const loader: LoaderFunction<{ title: string }> = async () => {
  return {
    props: { title: 'Hello' },
    maxAge: 0,
    sMaxAge: 60,
    swr: 300,
    cacheTags: ['home'],
  };
};
```

The renderer maps those fields to response headers in production:

- `maxAge`: browser `max-age`
- `sMaxAge`: CDN `s-maxage`
- `swr`: `stale-while-revalidate`
- `cacheTags`: appended to `Cache-Tag` with the global tag

For non-HTML endpoints such as `robots.txt`, `sitemap.xml`, feeds or JSON, return `rawResponse`:

```ts
export const loader = async () => {
  return {
    rawResponse: {
      body: 'User-agent: *\nDisallow:',
      contentType: 'text/plain; charset=utf-8',
      statusCode: 200,
    },
  };
};
```

L5E does not implement ISR. Configure your CDN to cache HTML and use cache tags for invalidation.
For many content sites this gets close to ISR behavior while keeping build and render logic simpler.
