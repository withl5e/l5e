import { SerializedHorizontalRuleNode } from '@payloadcms/richtext-lexical';
import type { JSXConverters } from '../types.js';
export const HorizontalRuleJSXConverter: JSXConverters<SerializedHorizontalRuleNode> = {
  horizontalrule: <hr />,
};
