---
title: useCss
description: Per-view CSS, included only when that view renders.
section: Style & CSS
order: 13
---

# useCss

- Call `useCss('src/views/<view>/styles.css')` inside the view component.
- L5E emits the `<link>` tag in the response and skips it on other views.
- In production, all view CSS for the request is bundled together for one round-trip.
