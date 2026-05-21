# L5E

L5E is an HTML-first SSR MPA framework for content-heavy applications that need predictable
server-rendered HTML, SEO metadata, cache headers and failure behavior.

It is intentionally not a streaming framework and does not include SSG/ISR in core. The design is
simple: render the whole page with all required data, return a complete response, and let the CDN
cache that response with normal HTTP headers and cache tags.

## Packages

- `@withl5e/l5e`: SSR renderer, Vite plugin, loader contract, middleware, SEO helpers, islands,
  actions, swap and tooltip runtime.
- `@withl5e/richtext-payload`: optional Payload Lexical renderer adapter. It is separate so the core
  package does not force Payload dependencies into every app.
- `create-l5e`: starter app generator for `npm create l5e`.

## Quick Start

```sh
npm create l5e@alpha my-app -- --template basic
cd my-app
npm run dev
```

Using pnpm:

```sh
pnpm create l5e@alpha my-app --template basic
cd my-app
pnpm dev
```

Available templates:

- `basic`: example app with middleware rewrite, loader cache headers, action and swap interaction
- `minimal`: small app with one server-rendered page

Run install and the dev server from one command:

```sh
pnpm create l5e@alpha my-app --template basic --dev
```

For local repository development:

```sh
pnpm install
pnpm --filter l5e-basic-example dev
```

The basic example includes:

- a home page rendered through L5E JSX
- middleware rewrite from `/rewrite-demo` to `/`
- loader cache headers
- action + swap interaction
- `client.global.ts` and `global.css`

## Scope

L5E is a good fit when:

- your pages are SEO-sensitive and should either render with all required data or fail clearly
- your app is mostly server-rendered HTML with small interactive islands
- you prefer HTTP/CDN caching over framework-owned SSG/ISR layers
- you want explicit middleware, loaders, cache tags and raw responses

L5E is probably not a good fit when:

- you want a React-first SPA framework
- you need first-class SSG/ISR or partial streaming as a core primitive
- most of your app state lives in the browser

## Design Decisions

L5E does not chase every frontend trend. It exists for a narrow operational need: pages whose
SEO, metadata, related data, headers and cache policy should be known before the response is sent.
Streaming can make cache tagging and all-or-nothing SEO behavior harder. SSG/ISR can be expensive
when global layout data changes often. L5E keeps the framework smaller and lets CDN cache policy
do the heavy lifting.

Read more in `docs/design-decisions.md`.

## Publishing

Publish all workspace packages from an authenticated npm session. Scoped
packages need `--access public` on first publish; pnpm reads each package's
`publishConfig.access` field, so this can be set per-package once and then
the workspace can be published in one command:

```sh
pnpm -r publish --tag alpha --no-git-checks
```

Or publish them one at a time in dependency order:

```sh
pnpm --filter @withl5e/l5e publish --tag alpha --access public --no-git-checks
pnpm --filter @withl5e/richtext-payload publish --tag alpha --access public --no-git-checks
pnpm --filter create-l5e publish --tag alpha --no-git-checks
```

If 2FA is enabled on the npm account, append `--otp=<code>` to each command.

Verify on the registry:

```sh
npm view @withl5e/l5e
npm view @withl5e/richtext-payload
npm view create-l5e
```

The create package must be named `create-l5e`; that is what lets users run
`npm create l5e@alpha my-app` or `npx create-l5e@alpha my-app`.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
```
