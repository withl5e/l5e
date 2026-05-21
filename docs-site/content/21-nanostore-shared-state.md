---
title: Nanostore & shared-state pitfalls
description: Sharing state between islands and vanilla client scripts.
section: Interactivity
order: 21
---

# Nanostore & shared-state pitfalls

- Use `nanostores` as a tiny cross-island bus; subscribe from vanilla scripts too.
- Pitfall: each chunk imports its own store unless the module is shared — check bundling.
- Pitfall: SSR has no client state; never read a store during render, only inside listeners.
