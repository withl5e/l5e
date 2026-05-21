import type { SerializedParagraphNode } from 'lexical';
import type { JSXConverter, JSXConverters } from '../types.js';

type ParagraphConverterArgs = Parameters<
  Extract<JSXConverter<SerializedParagraphNode>, (...args: any[]) => JSX.Element>
>[0];

export const ParagraphJSXConverter: JSXConverters<SerializedParagraphNode> = {
  paragraph: ({ node, nodesToJSX }: ParagraphConverterArgs) => {
    const children = nodesToJSX({
      nodes: node.children,
    });

    if (!children?.length) {
      return (
        <p>
          <br />
        </p>
      );
    }

    return <p>{children}</p>;
  },
};
