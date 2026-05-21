---
title: Environment Variables
description: Server-only secrets and client-safe public values.
section: Environment
order: 22
---

# Environment Variables

- Server-only: read `mport.meta.env.X` inside `loader.ts`, `actions.tsx`, `middleware.ts`, `views/x/index.tsx`.
- Client-safe: expose via Vite's `import.meta.env.VITE_*` prefix.
- Never put secrets behind `VITE_` — anything prefixed lands in the client bundle.
