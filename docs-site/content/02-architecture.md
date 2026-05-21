---
title: Architecture
description: How a request becomes minimal, dynamic HTML in L5E.
section: Welcome
order: 2
---

# Architecture

- **Per-request render context (AsyncLocalStorage).** `useCss` / `useClientJs` / `registerIsland` push into a per-request registry *at render time* — components that don't render don't register.
- **Runtime bundling, not build-time.** After render, the framework merges the request's registered CSS and client scripts into a single hashed chunk per response; the HTML gets one link tag and one script tag.
- Pipeline: Express → middleware → route → loader → component render (registers assets) → bundle on the fly → headers + body. Vite handles dev HMR; production reuses the same context.
