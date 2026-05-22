# L5E

HTML-first SSR MPA framework with **per-request CSS/JS bundling** — only the components actually rendered ship to the browser. One `<link>`, one `<script>`, nothing more.

📖 **Full docs: [l5e.dev/docs/why-l5e](https://l5e.dev/docs/why-l5e)**

## Quick start

```sh
npm create l5e@alpha my-app -- --template basic
cd my-app
npm run dev
```

Templates: `basic` (middleware + loader cache + action/swap) · `minimal` (one server-rendered page).

## Packages

| Package | What |
|---|---|
| [`@withl5e/l5e`](./packages/core) | SSR renderer, Vite plugin, loaders, middleware, SEO, islands, actions, swap |
| [`@withl5e/richtext-payload`](./packages/richtext-payload) | Payload Lexical renderer (optional) |
| [`create-l5e`](./packages/create-l5e) | Starter generator for `npm create l5e` |

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
```
