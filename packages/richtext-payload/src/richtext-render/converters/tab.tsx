import type { SerializedTabNode } from 'lexical';
import type { JSXConverters } from '../types.js';

export const TabJSXConverter: JSXConverters<SerializedTabNode> = {
  tab: '\t',
};
