---
title: Images (CDN-driven)
description: Defer image transforms to the CDN, not the framework.
section: SEO
order: 23
---

# Images (CDN-driven)

- L5E does not ship an `<Image>` component — emit plain `<img>` and let the CDN resize.
- Set `width`/`height` on every image to prevent CLS; use `loading="lazy"` below the fold.
- For OG images: absolute URLs in `metadata.openGraph.images` (Twitter / Slack require absolute).
