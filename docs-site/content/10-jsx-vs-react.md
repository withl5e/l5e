---
title: JSX (vs React)
description: L5E's JSX runtime renders to an HTML string, not a virtual DOM.
section: Component
order: 10
---

# JSX (vs React)

- HTML attributes win: `class` (not `className`), `for` (not `htmlFor`), lowercase event names.
- No hooks lifecycle — components are called once per request, server-side only.
- `setHtml` instead of `dangerouslySetInnerHTML`; islands handle the hydration story.
