import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical';
import type { SerializedTextNode } from 'lexical';

export function getTextLexicalNode(node: SerializedLexicalNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') {
    return (node as SerializedTextNode).text || '';
  }
  if (!('children' in node) || !Array.isArray(node.children)) return '';
  return node.children.map((child) => getTextLexicalNode(child)).join('');
}
