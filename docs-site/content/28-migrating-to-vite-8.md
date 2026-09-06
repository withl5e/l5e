---
title: Migrating an L5E app to Vite 8
description: Upgrade a consumer L5E project from Vite 7 to the Vite 8 based release and verify its server, client, and production pipeline.
section: Guides
order: 28
---

# Migrating an L5E app to Vite 8

This guide is for an existing L5E app that uses the Vite 7 based release. It applies to
the forthcoming Vite 8 L5E release, `@withl5e/l5e@0.4.0`; use these install commands
once that release is published. Upgrade the framework package and Vite together, then
run the checks below before deploying.

## Before you change dependencies

Vite 8 requires Node.js `^20.19.0 || >=22.12.0`. Check the version used locally and
in CI:

```bash
node --version
```

Keep the same package manager and lockfile that the project already uses. With pnpm,
for example, update the framework package and Vite with:

```bash
pnpm up @withl5e/l5e@^0.4.0 vite@^8

# React apps that still use @vitejs/plugin-react 4:
pnpm up --save-dev @vitejs/plugin-react@^6
```

For npm, use explicit major versions so an existing Vite 7 range does not prevent the
upgrade:

```bash
npm install @withl5e/l5e@^0.4.0
npm install -D vite@^8
```

For Yarn, use `yarn add @withl5e/l5e@^0.4.0` and `yarn add --dev vite@^8`. If a tool in
your dependency graph pins its own Vite peer, update that tool to a Vite 8 compatible
release before resolving peers.

Projects that use Vitest should use Vitest 4 or a later release supported by the L5E
release. Projects that do not use Vitest do not need to add it just for this migration.
Likewise, React projects may stay on `@vitejs/plugin-react` v5, which supports Vite 8;
the pnpm command above updates projects still using v4 to v6 for its Oxc based React
Refresh transform. Check the peer warnings after installation rather than suppressing
them.

## Update the Vite config

The Vite 8 compatibility layer converts the old names, but migrate them explicitly so
the project does not depend on deprecated options. In `vite.config.ts` or
`vite.config.js`, make these changes:

```diff
-  esbuild: {
-    jsx: 'preserve',
-  },
+  oxc: {
+    jsx: 'preserve',
+  },

   build: {
-    rollupOptions: {
+    rolldownOptions: {
       // keep the existing options here
     },
   },
```

The L5E templates only need `oxc: { jsx: 'preserve' }`. Only add `jsxInject` to files
that actually contain JSX. A library config that injects the L5E JSX runtime should use
`include: /\.[jt]sx$/` together with the runtime import. This scope matters: injecting a
JSX runtime import into ordinary server `.ts` or client `.js` files can pull server-only
modules into a browser bundle.
Keep existing `optimizeDeps.esbuildOptions` only when a plugin still requires it; Vite
8 can convert it, but `optimizeDeps.rolldownOptions` is the long-term form.

Do not mechanically rename every occurrence of “Rollup” in application code. A plugin
that uses the stable Vite/Rollup hook API can continue to work, while code that relies
on a specific Rollup implementation detail or bundle mutation needs its own test.

## Check esbuild users and plugins

Vite 8 uses Oxc and Rolldown internally. It no longer uses esbuild directly for its
main transform and bundle pipeline. L5E 0.4 still directly uses `esbuild` in its core
runtime, so an L5E app should keep the package and its install allowlist. Separately,
if another application plugin calls `transformWithEsbuild`, keep `esbuild` as an
explicit dev dependency and plan a move to `transformWithOxc` when that plugin supports
it. The package is also needed when the application itself imports an esbuild API.

If the project uses pnpm, retain the template's allowlist entry so esbuild's install
script can run:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

Do not add this setting when the project does not install esbuild. Review the actual
dependency tree with `pnpm why esbuild` (or the equivalent command for your manager).

## Verify the L5E pipeline

Run the normal project checks after reinstalling dependencies:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run dev
```

For a server rendered L5E app, check all of these in a real browser while `dev` is
running:

- the initial HTML contains the expected server rendered view;
- each island hydrates and responds to a click or input;
- client scripts, CSS, images, and dynamic imports return successfully;
- server actions and fragment/tooltip requests return the expected status and content;
- navigation, error routes, and any locale or middleware redirects still work; and
- the browser console and dev server show no new errors or failed requests.

Then stop the dev server and exercise the production command used by the deployment.
At minimum, load the built app in a browser and repeat the island, action, asset, and
navigation checks. A successful `vite build` alone does not prove that SSR asset
manifest lookups or client hydration work at runtime.

## If the upgrade fails

First record the Node version, package manager, Vite version, L5E version, and the
smallest failing route or plugin. Remove stale build output and reinstall using the
project's normal lockfile workflow.

Check the [Vite migration from v7 guide](https://vite.dev/guide/migration.html) for
the complete list of changed options and advanced incompatibilities. The [Vite 8
release announcement](https://vite.dev/blog/announcing-vite8) explains the Rolldown/Oxc
pipeline, and the [Vitest migration guide](https://vitest.dev/guide/migration.html)
covers the Vitest 4 changes. Report a reproducible plugin or framework incompatibility
with the versions and build mode included.
