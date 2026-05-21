---
title: Environment Variables
description: Server-only secrets and client-safe public values.
section: Environment
order: 19
---

# Environment Variables

- Server-only: read `process.env.X` inside `loader.ts`, `actions.tsx`, `middleware.ts`.
- Client-safe: expose via Vite's `import.meta.env.VITE_*` prefix.
- Never put secrets behind `VITE_` — anything prefixed lands in the client bundle.
