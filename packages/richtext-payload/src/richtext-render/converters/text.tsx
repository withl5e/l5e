import { NodeFormat } from '@payloadcms/richtext-lexical';
import type { SerializedTextNode } from 'lexical';
import type { JSXConverter, JSXConverters } from '../types.js';

type TextConverterArgs = Parameters<
  Extract<JSXConverter<SerializedTextNode>, (...args: any[]) => JSX.Element>
>[0];

export const TextJSXConverter: JSXConverters<SerializedTextNode> = {
  text: ({ node }: TextConverterArgs) => {
    let text: JSX.Element = node.text;

    if (node.format & NodeFormat.IS_BOLD) {
      text = <strong>{text}</strong>;
    }
    if (node.format & NodeFormat.IS_ITALIC) {
      text = <em>{text}</em>;
    }
    if (node.format & NodeFormat.IS_STRIKETHROUGH) {
      text = <span style="text-decoration: line-through;">{text}</span>;
    }
    if (node.format & NodeFormat.IS_UNDERLINE) {
      text = <span style="text-decoration: underline;">{text}</span>;
    }
    if (node.format & NodeFormat.IS_CODE) {
      text = <code>{text}</code>;
    }
    if (node.format & NodeFormat.IS_SUBSCRIPT) {
      text = <sub>{text}</sub>;
    }
    if (node.format & NodeFormat.IS_SUPERSCRIPT) {
      text = <sup>{text}</sup>;
    }

    return text;
  },
};
