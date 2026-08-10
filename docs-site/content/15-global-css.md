---
title: Global CSS
description: Stylesheets loaded on every page.
section: Style & CSS
order: 15
---

# Global CSS

- Create `src/global.css`. Its presence is the declaration; no server or Vite
  option is required.
- The framework emits it as a stylesheet link in `<head>` on every page, so
  critical layout CSS is present before global client JavaScript executes.
- Compose additional global styles with ordered `@import` rules at the top of
  `global.css`.
- Keep `src/client.global.ts` for JavaScript only. Do not import `global.css`
  from it.
- Development uses Vite's source CSS URL and HMR. Production maps the same file
  through the Vite manifest to its hashed asset.
