# Payload Rich Text Adapter

Payload/Lexical rich text rendering lives in `@l5e/richtext-payload`, not in `@l5e/core`.

This keeps core apps from installing Payload dependencies when they only need SSR, middleware,
loaders, SEO, actions, swap or islands.

Install:

```sh
pnpm add @l5e/richtext-payload @payloadcms/richtext-lexical lexical payload
```

Render:

```tsx
import { convertLexicalToJSX, defaultJSXConverters } from '@l5e/richtext-payload';

export function RichText({ data }) {
  return convertLexicalToJSX({
    converters: defaultJSXConverters,
    data,
  });
}
```

Custom blocks and inline blocks are passed through converter maps:

```tsx
const converters = {
  ...defaultJSXConverters,
  blocks: {
    callout: ({ node }) => <aside>{node.fields.title}</aside>,
  },
  inlineBlocks: {
    badge: ({ node }) => <span class="badge">{node.fields.label}</span>,
  },
};
```
