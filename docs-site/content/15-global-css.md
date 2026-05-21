---
title: Global CSS
description: Stylesheets loaded on every page.
section: Style & CSS
order: 15
---

# Global CSS

- Import CSS from `src/client.global.ts` — bundled into the global entry.
- Loaded on every page regardless of view; good for resets, tokens, base typography.
- Production: merged into a single global chunk via the Vite plugin.
