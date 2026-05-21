# @l5e/richtext-payload

Payload Lexical rich text rendering is kept outside `@l5e/core` so the framework core does not
force Payload, Lexical or CMS-specific types into every L5E app.

Install it only in apps that render Payload rich text:

```sh
pnpm add @l5e/richtext-payload @payloadcms/richtext-lexical lexical payload
```

Usage:

```tsx
import {
  convertLexicalToJSX,
  defaultJSXConverters,
} from '@l5e/richtext-payload';

export function ArticleBody({ content }) {
  return convertLexicalToJSX({
    converters: defaultJSXConverters,
    data: content,
  });
}
```
