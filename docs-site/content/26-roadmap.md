---
title: Roadmap
description: How L5E got here — from an internal tool to an open-source framework — and what is coming next.
section: Roadmap
order: 26
---

# Roadmap

L5E started as one team's answer to a content-site problem and was only open-sourced after it held up on real traffic. Here's where it's been and where it's going — a direction, not a contract.

## The path so far

- **Internal use — *shipped*.** JSX on the server, a clean HTML body, and a per-request bundler that ships only the assets the rendered blocks asked for. See [[01-why-l5e]] for the motivation.
- **Proven in production — *shipped*.** Ran on three public content sites with stable indexing and healthy Core Web Vitals before any of it was published.
- **Forked to open source — *shipped*.** The portable core — runtime, router, per-request bundler — extracted out, site-specific glue left behind.
- **Documentation — *in progress*.** This site: runtime, routing, styling/interactivity primitives, and the SEO story, filled in as the public API settles.
- **Rolldown + Vite 8 — *implemented for 1.0.0-alpha.0*.** The build and per-request bundler now use Rolldown, with Vite 8 and Oxc completing the unified toolchain.

## What is next

- **Starter templates — *planned*.** A working skeleton — install flow, structure, a few views, caching defaults wired up — to clone and edit, not a kitchen-sink boilerplate.
- **Showcase sites — *planned*.** Two reference builds that double as living docs: a news/content site (cache-friendly pages, search, sitemaps) and an e-commerce storefront (block-builder layouts, islands + client-JS for cart/filters).

---

Order and scope can shift as the public API and community feedback settle. If something here matters to you, that's exactly the kind of signal worth raising.
