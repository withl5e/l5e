import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical';
import { getTextLexicalNode } from './getTextOfLexical.js';

const WORDS_PER_MINUTE = 210;

export function getTimeRead(node: SerializedLexicalNode | null | undefined): number {
  if (!node) return 0;
  const text = getTextLexicalNode(node);
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  return Math.max(1, minutes); // Return at least 1 minute
}
