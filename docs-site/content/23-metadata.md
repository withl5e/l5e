---
title: Metadata
description: title, description, OG, Twitter — emitted from the loader.
section: SEO
order: 23
---

# Metadata

- Export `generateMetadata(requestInfo, props)` from `loader.ts` to return a `Metadata` object.
- Framework auto-renders the meta tags — no `<MetadataRenderer>` in the view JSX.
- Hierarchy: `global-loader.generateMetadata` → view `generateMetadata` (view wins on conflicts).
- `alternateLocales: Record<string, string>` renders one `<link rel="alternate" hreflang="...">`
  per entry (keys are BCP-47 tags or `x-default`) — for a multi-language site, compute this
  once in `global-loader.generateMetadata` from `requestInfo.pathname` so every view gets it
  automatically, instead of declaring it per view. See [[27-i18n]].
