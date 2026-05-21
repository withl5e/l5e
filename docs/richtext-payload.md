# Payload Rich Text Adapter

Payload/Lexical rich text rendering lives in `@withl5e/richtext-payload`, not in `@withl5e/l5e`.

This keeps core apps from installing Payload dependencies when they only need SSR, middleware,
loaders, SEO, actions, swap or islands.

Install:

```sh
pnpm add @withl5e/richtext-payload @payloadcms/richtext-lexical lexical payload
```

Render:

```tsx
import { convertLexicalToJSX, defaultJSXConverters } from '@withl5e/richtext-payload';

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
