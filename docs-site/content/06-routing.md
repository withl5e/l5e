---
title: Routing
description: Mapping URLs to view names with src/route.ts.
section: Routing & Navigation
order: 6
---

# Routing

- `src/route.ts` exports a default function `(requestInfo) => viewName | null`.
- Return `null` to opt out (lets static or 404 handlers take over).
- All routing logic is plain code — patterns, regex, or DB lookups all welcome.
