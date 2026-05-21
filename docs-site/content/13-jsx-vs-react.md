---
title: JSX (vs React)
description: L5E's JSX runtime is server-only and HTML-native — same syntax, different rules.
section: Component
order: 13
---

# JSX (vs React)

L5E uses the JSX syntax you already know, but the runtime is small, server-only, and writes
**HTML-standard attribute names** straight into a string. Everything you'd reach for via
`react-dom/server` happens differently here — usually because L5E doesn't need it.



## Attribute naming: HTML, not React

The runtime emits attributes verbatim. Use **HTML standard names**, not React's camel-cased
versions.

| React | L5E (HTML) |
|---|---|
| `className` | `class` |
| `htmlFor` | `for` |
| `tabIndex` | `tabindex` |
| `colSpan` / `rowSpan` | `colspan` / `rowspan` |
| `onClick`, `onChange`, … | — *(use `useClientJs` or an island)* |
| `dangerouslySetInnerHTML={{ __html }}` | `setHtml={html}` |
| `style={{ color: 'red' }}` (object) | `style="color: red"` (string) |
| `aria-labelledBy` | `aria-labelledby` |

```tsx
<label for="email">Email</label>
<input id="email" name="email" type="email" tabindex={0} />
<table>
  <th colspan={2}>Header</th>
</table>
```

No prop translation, no surprise — what you write is what the browser parses.

## Style is a string

`style` accepts a CSS declaration string, not an object. Same as raw HTML:

```tsx
<div style="display: grid; gap: 1rem;">…</div>
```

For dynamic style, compose the string yourself or compute in the loader. Inline styles in MPAs
are almost always a smell — use a CSS file with `useCss` instead.

## Class helpers

`class` is a string. For conditional class composition, L5E adds `classList` (filtered out at
render, merged into `class`):

```tsx
<button
  class="btn"
  classList={['btn--primary', isLoading && 'btn--loading']}
>
  Submit
</button>

<a
  class="docs-link"
  classList={{ 'docs-link--active': item.slug === currentSlug }}
>
  {item.title}
</a>
```

`classList` accepts a string, an array (falsy entries dropped), or an object (keys whose value
is truthy are kept). The final attribute is a normal `class="…"` in the output HTML.

## Raw HTML: `setHtml` / `setText`

```tsx
<article setHtml={renderedMarkdown} />
<div setText={userInput} />     {/* escaped */}
```

- `setHtml` writes the string directly — caller is responsible for trusted input. This is the
  one-line replacement for `dangerouslySetInnerHTML`.
- `setText` writes the string with HTML escaping. Cheaper than `{userInput}` when the value is
  known to be a primitive.

Both filter out at render time and become the element's body.

## `cacheTag` on any element

Any JSX element can attach a cache tag to the current request:

```tsx
<section cacheTag="featured-posts">
  {posts.map((p) => <PostCard post={p} cacheTag={`post:${p.id}`} />)}
</section>
```

The tag bubbles into the render context and ends up in the response `Cache-Tag` header —
see SEO → Cache Tags.

## No client lifecycle

Components are **plain functions called once, server-side, per request**.

- No `useState`, `useEffect`, `useRef`, `useMemo`, no lifecycle methods.
- No event handlers in the JSX (`onClick={…}` is not wired up — clicks happen in the browser,
  your component code does not).
- No re-rendering; the function returns once and the output is a string.

If you need interactivity:

- **Plain DOM behavior** → `useClientJs('/src/views/<view>/client.ts')` ships a vanilla TS
  script for this view ([[14-useclientjs]]).
- **Server-rendered fragments swapped into the DOM** → `defineAction` + `createSwap`
  ([[16-swap-and-action]]).
- **React component with state** → islands ([[17-islands]]).

## Conditionals and lists

Standard JSX. Both `false` and `null` render to nothing.

```tsx
{user ? <Welcome name={user.name} /> : null}

{items.length > 0 && (
  <ul>
    {items.map((item) => <li>{item.title}</li>)}
  </ul>
)}
```

There is no `key` requirement on list items (no reconciliation diff), but the type does accept
a `key` prop if you want one for clarity.

## Async components

Components are **synchronous functions**. Don't return a Promise from a component. Do data
fetching in `loader.ts`, pass props to the component:

```tsx
// loader.ts
export const loader: LoaderFunction = async () => ({
  props: { articles: await db.articles.findMany({ take: 10 }) },
});

// index.tsx
export default function ArticlesPage({ articles }) {
  return <ul>{articles.map((a) => <li>{a.title}</li>)}</ul>;
}
```

## SVG and custom attributes

SVG attributes use HTML/SVG standard names (`viewBox`, `stroke-width`, `xlink:href`, …):

```tsx
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
</svg>
```

`data-*` and `aria-*` attributes are typed as catch-all strings, so any custom data attribute
works:

```tsx
<div data-state="open" data-step={3} aria-busy={isLoading}>…</div>
```

## TypeScript types

The runtime ships a global `JSX` namespace with intrinsic element typings (HTML standard
attributes, microdata, SVG, ARIA). You don't need to install `@types/react`. If you do have it
in the project for some reason, the L5E types deliberately override `JSX.Element` so React's
definitions don't leak into your views.

## Quick mental model

> **HTML in, HTML out.** L5E's JSX is a thin convenience over an HTML string builder. If
> something feels like a virtual-DOM-ism (objects-as-styles, camelCased attributes, lifecycle,
> events on JSX), it isn't here.
