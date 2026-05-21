# Design Decisions

L5E deliberately does not include streaming, SSG or ISR in core.

## No Streaming

For SEO pages, the desired behavior is usually all required data or a clear failure. Metadata,
schema, related content, cache tags and status code should be known before headers are sent. Once
streaming starts sending the response, some decisions are already committed.

Streaming also makes cache tagging awkward. A page might need one tag for the article, another tag
for related content, and another tag for global layout data. If the header has already been sent,
the framework has less room to express that final cache policy.

## No SSG Or ISR

Many sites have global data that changes frequently: navigation, footer links, banners, settings or
shared layout fragments. SSG can turn those changes into broad rebuilds. L5E keeps rendering
dynamic and expects CDN caching to absorb traffic.

The recommended production model is:

- render the full page on the server
- emit normal HTTP cache headers
- attach cache tags
- configure the CDN to cache HTML
- purge by tag when content changes

## Scope

L5E is not trying to be the fastest framework in benchmarks. It is designed to fit a specific
need: SSR pages with explicit data loading, SEO, cache policy and small opt-in client interactivity.
