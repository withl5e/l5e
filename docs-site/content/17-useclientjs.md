---
title: useClientJs (vanilla)
description: Ship a plain-TS client script for a view.
section: Interactivity
order: 17
---

# useClientJs (vanilla)

- Call `useClientJs('/src/views/<view>/client.ts')` to attach a script to the page.
- Runs after HTML parse; use plain DOM APIs, listeners, fetch — no framework required.
- Production: per-view client scripts are merged into a single `/bundle-<hash>.js`.

## Path convention

> **The path must be an absolute path from the project root, starting with
> `/src/`** — e.g. `/src/views/home/client.ts`. Relative forms
> (`./client.ts`, `../shared/x.ts`) and bare paths (`src/views/...`
> without the leading `/`) are not supported.

This is because the build-time bundler regex-scans your view files for
literal `useClientJs('…')` calls **before any JS executes** — the
argument has to be a string the scanner can resolve without knowing
the calling file's location.

**Planned for a later release**: a path helper that gives you typesafe
imports and relative paths (`useClientJs(client('./client.ts'))` or
similar) without losing the static scannability the bundler relies on.
