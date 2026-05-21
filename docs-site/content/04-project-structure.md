---
title: Project Structure
description: The minimum files an L5E app needs.
section: Start
order: 4
---

# Project Structure

- Root: `server.ts`, `vite.config.js`, `index.html`, `tsconfig.json`.
- `src/`: `route.ts`, `entry-server.ts`, `client.global.ts`, optional `middleware.ts`, `global-loader.ts`.
- `src/views/<view>/`: `index.tsx`, optional `loader.ts`, `actions.tsx`, `client.ts`, CSS.
