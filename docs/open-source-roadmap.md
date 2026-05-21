# Open Source Roadmap

## Alpha

- publish `@l5e/core` as an alpha package
- publish `@l5e/richtext-payload` as an optional adapter
- keep docs focused on actual usage, not internals first
- ship a minimal starter and a few focused examples
- mark unstable APIs clearly

## DX Baseline

- starter can be installed with `npm create l5e` or `npx create-l5e`
- errors mention the missing file or wrong import path
- middleware rewrite, loaders, cache headers, actions and islands have copyable examples
- docs explain the project scope and who should not use it

## Community Scope

L5E is for people building SEO-sensitive SSR pages with explicit cache behavior and limited client
interactivity. It is not meant to compete with every full-stack framework. Keeping that scope clear
should reduce mismatched expectations and toxic discussions.

## Stabilization

- collect real app feedback before `1.0`
- avoid adding large features to core when recipes or adapters are enough
- keep compatibility tests for public APIs
- publish migration notes for breaking changes
