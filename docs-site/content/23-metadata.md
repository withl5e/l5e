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
