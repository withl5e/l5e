---
title: useClientJs (vanilla)
description: Ship a plain-TS client script for a view.
section: Interactivity
order: 17
---

# useClientJs (vanilla)

- Call `useClientJs('src/views/<view>/client.ts')` to attach a script to the page.
- Runs after HTML parse; use plain DOM APIs, listeners, fetch — no framework required.
- Production: per-view client scripts are merged into a single `/bundle-<hash>.js`.
