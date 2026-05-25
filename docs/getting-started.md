# Getting Started

Create a new app with the starter:

```sh
npm create l5e my-app -- --template basic
cd my-app
npm run dev
```

Using pnpm:

```sh
pnpm create l5e my-app --template basic
cd my-app
pnpm dev
```

Available templates:

- `basic`: example app with middleware rewrite, loader cache headers, action and swap interaction
- `minimal`: small app with one server-rendered page

Or run install and the dev server from one command:

```sh
pnpm create l5e my-app --template basic --dev
```

## Manual App

Create a L5E app with these files:

```txt
src/
  route.ts
  entry-server.ts
  client.global.ts
  global.css
  views/home/index.tsx
  views/home/loader.ts
index.html
server.ts
vite.config.js
```

Use L5E JSX in view files:

```tsx
import { useCss } from '@withl5e/l5e/jsx-runtime';

export default function HomePage() {
  useCss('/src/views/home/home.css');
  return <main>Hello from L5E</main>;
}
```

Use a route function to map the request to a view:

```ts
import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler(requestInfo: RequestInfo) {
  if (requestInfo.pathname === '/') return 'home';
  return null;
}
```

For apps with dynamic segments or catch-all routes, use the typed route table —
see [docs/router.md](./router.md):

```ts
import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/blog/$slug', view: 'article' },
  { path: '/docs/$', view: 'docs' },
]);
```

Start the server:

```ts
import { startServer } from '@withl5e/l5e/server';

startServer({
  root: process.cwd(),
  publicDir: './public',
});
```
