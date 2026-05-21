---
title: Swap + Action
description: Server actions that return HTML fragments swapped into the DOM.
section: Interactivity
order: 16
---

# Swap + Action

- `defineAction({ method, handler })` in `actions.tsx`; handler returns JSX.
- Client transform turns the import into a `fetch('/_l5e/action/<name>_<hash>')` stub.
- `createSwap({ trigger, target, swap, action })` wires the click → fetch → DOM patch.
