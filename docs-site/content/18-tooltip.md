---
title: Tooltip
description: Hover/focus tooltips powered by Floating UI.
section: Interactivity
order: 18
---

# Tooltip

- Import from `@withl5e/l5e/tooltip`; mount once from a client script.
- HTML-driven: add `data-tooltip="..."` (or a target selector) to any element.
- Lazy-positioned with `@floating-ui/dom`; zero per-element setup in the SSR HTML.
- Default fetch URL is `/tooltip/:type/:id` — unchanged, no config needed. Call
  `configureTooltip('auto-locale' | strategy)` **once**, e.g. in `client.global.ts`, to
  change how every tooltip's URL is built app-wide (locale-prefixed for CDN caching, a
  different API path, whatever). See [[27-i18n]] for the locale case.
