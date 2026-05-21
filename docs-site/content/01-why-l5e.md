---
title: Why L5E
description: Block-builder pages where only the blocks you actually render ship CSS and JS — that's the core motivation.
section: Welcome
order: 1
---

# Why L5E

- **Per-request bundling, not build-time tree-shaking.** A page can compose nested builder blocks; only the blocks that render this request register their CSS / JS. Bundle size tracks what was rendered, not what could be rendered.
- **Tiny, readable HTML output.** One `<link>` for CSS, one `<script>` for JS — no inline blobs, no per-block tags spamming the page.
- Designed for SEO-sensitive, content-heavy MPAs: all-or-nothing SSR, CDN-friendly headers, no streaming, no SSG/ISR built in.
