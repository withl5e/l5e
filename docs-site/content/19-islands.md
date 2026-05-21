---
title: Islands (React)
description: Hydrate React components inside the server-rendered page.
section: Interactivity
order: 19
---

# Islands (React)

- `@withl5e/l5e/island` registers a component; `@withl5e/l5e/island/client` hydrates it.
- Island metadata travels in `window.__L5E_ISLANDS__` and resolves to the right chunk.
- Reach for islands only when DOM-only solutions (swap, vanilla client) aren't enough.
