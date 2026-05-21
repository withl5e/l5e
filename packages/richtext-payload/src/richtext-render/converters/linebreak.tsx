import type { SerializedLineBreakNode } from 'lexical';
import type { JSXConverters } from '../types.js';

export const LinebreakJSXConverter: JSXConverters<SerializedLineBreakNode> = {
  linebreak: <br />,
};
