---
title: useCss
description: Per-view CSS, included only when that view renders.
section: Style & CSS
order: 16
---

# useCss

- Call `useCss('/src/views/<view>/styles.css')` inside the view component.
- L5E emits the `<link>` tag in the response and skips it on other views.
- In production, all view CSS for the request is bundled together for one round-trip.

## Calling it more than once

Registering the same path several times in one request — a shared component
that renders twice, a layout and a page that both need the file — emits a
single `<link>`. The first call decides where the file lands in the cascade;
later calls for the same path are ignored. This holds in dev and in
production.

## Path convention

> **The path must be an absolute path from the project root, starting with
> `/src/`** — e.g. `/src/views/home/styles.css`. Relative forms
> (`./styles.css`, `../shared/x.css`) and bare paths (`src/views/...`
> without the leading `/`) are not supported.

This is because the build-time bundler regex-scans your view files for
literal `useCss('…')` calls **before any JS executes** — the argument
has to be a string the scanner can resolve without knowing the calling
file's location.

**Planned for a later release**: a path helper that gives you typesafe
imports and relative paths (`useCss(css('./styles.css'))` or similar)
without losing the static scannability the bundler relies on.
