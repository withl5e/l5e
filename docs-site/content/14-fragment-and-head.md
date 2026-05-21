---
title: Fragment & Head
description: Two runtime primitives for composing JSX trees and pushing into <head>.
section: Component
order: 14
---

# Fragment & Head

The JSX runtime exports a small handful of building blocks for composing views. This page
covers the two structural ones — `Fragment` and `Head`. For the request-context hook see
[[10-userequest-and-locals]].

```ts
import { Fragment, Head } from '@withl5e/l5e/jsx-runtime';
```

## `Fragment`

Explicit alternative to the `<></>` shorthand. **Prefer it.**

```tsx
import { Fragment } from '@withl5e/l5e/jsx-runtime';

export default function Page() {
  return (
    <Fragment>
      <Header />
      <main>…</main>
      <Footer />
    </Fragment>
  );
}
```

Why explicit:

- The shorthand `<></>` compiles via `jsxFragmentFactory`. With the L5E `tsconfig` it works,
  but **`<Fragment>` reads consistently across views**, IDE jump-to-def works, and grep finds
  it.
- `Fragment` also accepts `setHtml`, which the shorthand does not:

  ```tsx
  <Fragment setHtml={trustedHtmlString} />
  ```

  Equivalent to `<div setHtml={…} />` minus the wrapping element. Use for streaming raw
  markdown/HTML content where you don't want an extra `<div>`.

## `Head`

Declarative push into `<head>` from anywhere in the tree. The component returns `null` — it
registers its children into a per-request head registry and the framework flushes them sorted
by priority.

```tsx
import { Head } from '@withl5e/l5e/jsx-runtime';

function ArticleHead({ article }) {
  return (
    <Head>
      <link rel="canonical" href={`https://example.com/blog/${article.slug}`} />
      <link rel="alternate" type="application/rss+xml" href="/rss.xml" />
    </Head>
  );
}
```

### Priority

`Head` accepts a `priority` (number — lower renders first). The framework exposes named
constants for the common slots:

| Constant | Value | Use for |
|---|---|---|
| `HEAD_PRIORITY.CRITICAL` | 0 | `<meta charset>`, `<meta viewport>` |
| `HEAD_PRIORITY.HIGH` | 10 | `<title>`, `<meta description>`, canonical |
| `HEAD_PRIORITY.MEDIUM` | 50 | meta tags, robots, theme-color |
| `HEAD_PRIORITY.SEO` | 80 | OpenGraph, Twitter |
| `HEAD_PRIORITY.LOW` | 100 | custom head additions *(default)* |
| `HEAD_PRIORITY.SCRIPTS` | 200 | `<script>` tags emitted from `<Head>` |
| `HEAD_PRIORITY.STYLES` | 300 | `<style>` blocks |

```tsx
import { HEAD_PRIORITY } from '@withl5e/l5e';

<Head priority={HEAD_PRIORITY.HIGH}>
  <title>{title}</title>
</Head>
```

When you don't pass `priority`, the children land at `LOW` — fine for most ad-hoc additions.

### When to reach for `Head` vs. `generateMetadata`

| Use `generateMetadata` (in `loader.ts`) | Use `<Head>` (in JSX) |
|---|---|
| Page-level `<title>`, description, OG, Twitter, robots | One-off element a sub-component needs |
| Anything derived from loader data | A widget that needs to register `<link rel="preload">` for its own asset |
| All "SEO" concerns | Schema-org snippets injected by a component (or use `generateSchema`) |

`generateMetadata` is the high-level surface; `<Head>` is the escape hatch when a component
needs to add something to the document head from inside the tree.

## Related hooks

In the same module you'll often import:

- [[14-usecss]] — `useCss(path)` registers a CSS file for the current view.
- [[15-useclientjs]] — `useClientJs(path)` registers a client-side script for the current view.
- [[10-userequest-and-locals]] — `useRequest()` reads the request context inside any component.
