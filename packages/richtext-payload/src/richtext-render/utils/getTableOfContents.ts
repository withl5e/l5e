import type { SerializedHeadingNode } from '@payloadcms/richtext-lexical';
import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical';
import type { SerializedEditorState } from 'lexical';
import { getTextLexicalNode } from './getTextOfLexical.js';

export interface TableOfContentsHeading {
  text: string;
  level: number;
}

export interface TableOfContentsHeadingWithChildren extends TableOfContentsHeading {
  children: TableOfContentsHeadingWithChildren[];
}

// Hàm lấy tất cả các heading từ content
export function getHeaders(
  node: SerializedLexicalNode | SerializedEditorState,
): TableOfContentsHeading[] {
  const headers: TableOfContentsHeading[] = [];

  // Handle SerializedEditorState
  if ('root' in node && node.root) {
    return getHeaders(node.root);
  }

  // At this point, node must be SerializedLexicalNode
  const lexicalNode = node as SerializedLexicalNode;

  // Handle heading node
  if (lexicalNode.type === 'heading') {
    const headingNode = lexicalNode as SerializedHeadingNode;
    const tag = headingNode.tag || '';
    const level =
      tag === 'h2'
        ? 2
        : tag === 'h3'
          ? 3
          : tag === 'h4'
            ? 4
            : tag === 'h5'
              ? 5
              : tag === 'h6'
                ? 6
                : 0;
    if (level > 0) {
      const text = getTextLexicalNode(lexicalNode);
      if (text) {
        headers.push({
          text,
          level,
        });
      }
    }
  }

  // Recursively process children
  if ('children' in lexicalNode && Array.isArray(lexicalNode.children)) {
    lexicalNode.children.forEach((child) => {
      headers.push(...getHeaders(child));
    });
  }

  return headers;
}

// Xây dựng cấu trúc mục lục
export function buildTableOfContents(
  headers: TableOfContentsHeading[],
): TableOfContentsHeadingWithChildren[] {
  const result: TableOfContentsHeadingWithChildren[] = [];
  const stack: TableOfContentsHeadingWithChildren[] = [];

  headers.forEach((header) => {
    const headingWithChildren: TableOfContentsHeadingWithChildren = {
      ...header,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      result.push(headingWithChildren);
    } else {
      stack[stack.length - 1].children.push(headingWithChildren);
    }

    stack.push(headingWithChildren);
  });

  return result;
}
