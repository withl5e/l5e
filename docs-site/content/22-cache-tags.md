---
title: Cache Tags (component + loader)
description: Tag responses for granular CDN purging.
section: SEO
order: 22
---

# Cache Tags (component + loader)

- Loader: `cacheTags: ['foo', 'bar']` adds tags onto the response.
- Components: pass `cacheTag="…"` on any element — it bubbles up via the render context.
- Production hashes every tag (except `global`) to keep the `Cache-Tag` header small.
